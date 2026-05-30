import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from '@langchain/google-genai';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
} from '@langchain/core/messages';
import { DatabaseService } from '../database/database.service';
import { ConversationsService } from '../conversations/conversations.service';

interface DocumentRow {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

interface ChunkMeta {
  filename?: string;
  chunkIndex?: number;
}

// Top N similarity chunks retrieved per document
const SIMILARITY_CHUNKS_PER_DOC = 4;

// Simple English stop words — excluded from keyword re-ranking
const STOP_WORDS = new Set([
  'a','an','the','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','should',
  'could','may','might','shall','can','need','dare','ought','used',
  'to','of','in','for','on','with','at','by','from','as','into',
  'through','during','before','after','above','below','between',
  'out','off','over','under','again','then','once','what','which',
  'who','how','when','where','why','and','but','or','nor','not',
  'so','yet','both','either','neither','this','that','these','those',
  'i','you','he','she','it','we','they','me','him','her','us','them',
]);

export interface QueryResult {
  answer: string;
  sources: string[];
}

// Discriminated union for streaming events yielded by streamAnswer()
export type StreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'done'; sources: string[] };

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private readonly embeddings: GoogleGenerativeAIEmbeddings;
  private readonly chat: ChatGoogleGenerativeAI;

  constructor(
    private readonly db: DatabaseService,
    private readonly convs: ConversationsService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey,
      modelName: 'gemini-embedding-001',
    });

    this.chat = new ChatGoogleGenerativeAI({
      apiKey,
      model: 'gemini-2.5-flash',
      temperature: 0,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  answer()  — regular (non-streaming) response
  // ══════════════════════════════════════════════════════════════════════════
  async answer(question: string, userId: number, sessionId: string): Promise<QueryResult> {
    try {
      const { context, docMap, sources } = await this.retrieve(question, userId);
      if (!context) {
        return {
          answer: 'No relevant documents found. Please upload a PDF first.',
          sources: [],
        };
      }

      const messages = await this.buildMessages(question, context, docMap.size, userId, sessionId);
      const response = await this.chat.invoke(messages);
      const answer =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);

      await this.convs.save(userId, sessionId, question, answer, sources);
      return { answer, sources };
    } catch (err) {
      this.logger.error('Query failed', err);
      throw new InternalServerErrorException('Failed to process query');
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  streamAnswer()  — async generator; yields text chunks for SSE
  // ══════════════════════════════════════════════════════════════════════════
  async *streamAnswer(
    question: string,
    userId: number,
    sessionId: string,
  ): AsyncGenerator<StreamEvent> {
    const { context, docMap, sources } = await this.retrieve(question, userId);

    if (!context) {
      yield { type: 'chunk', text: 'No relevant documents found. Please upload a PDF first.' };
      yield { type: 'done', sources: [] };
      return;
    }

    const messages = await this.buildMessages(question, context, docMap.size, userId, sessionId);

    let fullAnswer = '';
    const stream = await this.chat.stream(messages);

    for await (const chunk of stream) {
      const text =
        typeof chunk.content === 'string' ? chunk.content : '';
      if (text) {
        fullAnswer += text;
        yield { type: 'chunk', text };
      }
    }

    await this.convs.save(userId, sessionId, question, fullAnswer, sources);
    // Signal end-of-stream with the source list so the client can display citations
    yield { type: 'done', sources };
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Step 1: Retrieve relevant chunks from the DB ─────────────────────────
  private async retrieve(question: string, userId: number) {
    // 1a. Embed the question
    const [questionVector] = await this.embeddings.embedDocuments([question]);
    const vectorLiteral = `[${questionVector.join(',')}]`;

    // 1b. Run two DB queries in parallel:
    //   - Similarity search: top-N chunks closest to the question vector
    //   - Header search: first chunk of every document (title / identity)
    const [simResult, headerResult] = await Promise.all([
      this.db.query<DocumentRow>(
        `SELECT content, metadata, similarity
         FROM (
           SELECT content,
                  metadata,
                  1 - (embedding <=> $1::halfvec) AS similarity,
                  ROW_NUMBER() OVER (
                    PARTITION BY metadata->>'filename'
                    ORDER BY embedding <=> $1::halfvec ASC
                  ) AS rn
           FROM documents
           WHERE user_id = $2
         ) ranked
         WHERE rn <= $3
         ORDER BY similarity DESC`,
        [vectorLiteral, userId, SIMILARITY_CHUNKS_PER_DOC],
      ),
      this.db.query<DocumentRow>(
        `SELECT DISTINCT ON (metadata->>'filename')
                content, metadata, 1 AS similarity
         FROM documents
         WHERE user_id = $1
         ORDER BY metadata->>'filename', (metadata->>'chunkIndex')::int ASC`,
        [userId],
      ),
    ]);

    if (simResult.rows.length === 0 && headerResult.rows.length === 0) {
      return { context: null, docMap: new Map(), sources: [] };
    }

    // 1c. Merge & deduplicate
    const seen = new Set<string>();
    const allRows: DocumentRow[] = [];
    for (const row of [...headerResult.rows, ...simResult.rows]) {
      if (!seen.has(row.content)) {
        seen.add(row.content);
        allRows.push(row);
      }
    }

    // 1d. Re-ranking: boost chunks that contain question keywords
    const reranked = this.rerank(question, allRows);

    // 1e. Group by document filename
    const docMap = new Map<string, DocumentRow[]>();
    for (const row of reranked) {
      const meta = row.metadata as ChunkMeta;
      const filename = meta?.filename ?? 'Unknown Document';
      if (!docMap.has(filename)) docMap.set(filename, []);
      docMap.get(filename)!.push(row);
    }

    // 1f. Build context string with clear document separators
    const contextSections: string[] = [];
    for (const [filename, chunks] of docMap) {
      const body = chunks.map((c) => c.content).join('\n---\n');
      contextSections.push(`=== Document: ${filename} ===\n${body}`);
    }
    const context = contextSections.join('\n\n');

    // 1g. Build sources list
    const sources = [...docMap.entries()].flatMap(([filename, chunks]) =>
      chunks.map((c) => {
        const meta = c.metadata as ChunkMeta;
        return `${filename} (chunk ${meta?.chunkIndex ?? '?'})`;
      }),
    );

    return { context, docMap, sources };
  }

  // ── Step 2: Re-ranking ───────────────────────────────────────────────────
  // Hybrid scoring = cosine similarity + keyword overlap boost.
  // Keywords are question words not in the stop-word list.
  //
  // Example:
  //   question: "What is John's annual salary?"
  //   keywords: ["john", "annual", "salary"]
  //   chunk A mentions "John" and "salary" → keyword_score = 2/3
  //   combined = 0.85 (cosine) + 0.3 * 0.67 = 0.85 + 0.20 = 1.05  ← ranks higher
  private rerank(question: string, rows: DocumentRow[]): DocumentRow[] {
    const keywords = question
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

    if (keywords.length === 0) return rows; // no boost possible

    return rows
      .map((row) => {
        const text = row.content.toLowerCase();
        const hits = keywords.filter((kw) => text.includes(kw)).length;
        const keywordScore = hits / keywords.length;
        const combined = Number(row.similarity) + 0.3 * keywordScore;
        return { ...row, _combined: combined };
      })
      .sort((a, b) => (b as any)._combined - (a as any)._combined);
  }

  // ── Step 3: Build AI messages with conversation history ──────────────────
  private async buildMessages(
    question: string,
    context: string,
    docCount: number,
    userId: number,
    sessionId: string,
  ) {
    const systemPrompt = `You are a helpful assistant that answers questions by analysing multiple documents.
The context below contains excerpts from ${docCount} document(s), each clearly separated by its filename.

Instructions:
- Answer using information from ALL relevant documents, not just one.
- If the question asks for data across multiple documents (e.g. "all names", "all salaries"), compile the answer from each document.
- Clearly attribute information to its source document when listing across multiple documents.
- Infer and summarise when needed — do not just quote verbatim.
- If a document does not contain relevant information for the question, skip it.
- If none of the documents contain relevant information, say "The documents do not appear to cover this topic."

Context:
${context}`;

    // Load recent history from THIS SESSION ONLY — so follow-ups like
    // "what about him?" resolve to the right person in the current chat,
    // not someone mentioned in a completely different previous session.
    const history = await this.convs.getRecentHistory(userId, sessionId);

    return [
      new SystemMessage(systemPrompt),
      // Interleave past Q&A pairs as Human + AI turns
      ...history.flatMap((h) => [
        new HumanMessage(h.question),
        new AIMessage(h.answer),
      ]),
      new HumanMessage(question),
    ];
  }
}
