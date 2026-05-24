import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { DatabaseService } from '../database/database.service';

interface DocumentRow {
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

interface ChunkMeta {
  filename?: string;
  chunkIndex?: number;
}

// Top N most relevant chunks retrieved per document via similarity search
const SIMILARITY_CHUNKS_PER_DOC = 4;

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private readonly embeddings: GoogleGenerativeAIEmbeddings;
  private readonly chat: ChatGoogleGenerativeAI;

  constructor(
    private readonly db: DatabaseService,
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

  async answer(question: string): Promise<{ answer: string; sources: string[] }> {
    try {
      const [questionVector] = await this.embeddings.embedDocuments([question]);
      const vectorLiteral = `[${questionVector.join(',')}]`;

      // Two parallel queries:
      // 1. Top SIMILARITY_CHUNKS_PER_DOC most relevant chunks per document (query-specific)
      // 2. First chunk of every document (always contains header/identity info)
      const [similarityResult, headerResult] = await Promise.all([
        this.db.query<DocumentRow>(
          `SELECT content, metadata, similarity
           FROM (
             SELECT content,
                    metadata,
                    1 - (embedding <=> $1::vector) AS similarity,
                    ROW_NUMBER() OVER (
                      PARTITION BY metadata->>'filename'
                      ORDER BY embedding <=> $1::vector ASC
                    ) AS rn
             FROM documents
           ) ranked
           WHERE rn <= $2
           ORDER BY similarity DESC`,
          [vectorLiteral, SIMILARITY_CHUNKS_PER_DOC],
        ),
        this.db.query<DocumentRow>(
          `SELECT DISTINCT ON (metadata->>'filename') content, metadata, 1 AS similarity
           FROM documents
           ORDER BY metadata->>'filename', (metadata->>'chunkIndex')::int ASC`,
          [],
        ),
      ]);

      if (similarityResult.rows.length === 0 && headerResult.rows.length === 0) {
        return {
          answer: 'No relevant documents found. Please upload a PDF first.',
          sources: [],
        };
      }

      // Merge: header chunks first (identity anchor), then similarity chunks, deduplicated
      const seen = new Set<string>();
      const allRows: DocumentRow[] = [];
      for (const row of [...headerResult.rows, ...similarityResult.rows]) {
        if (!seen.has(row.content)) {
          seen.add(row.content);
          allRows.push(row);
        }
      }

      // Group chunks by document so the LLM understands document boundaries
      const docMap = new Map<string, DocumentRow[]>();
      for (const row of allRows) {
        const meta = row.metadata as ChunkMeta;
        const filename = meta?.filename ?? 'Unknown Document';
        if (!docMap.has(filename)) docMap.set(filename, []);
        docMap.get(filename)!.push(row);
      }

      // Build context with clear document separators
      const contextSections: string[] = [];
      for (const [filename, chunks] of docMap) {
        const body = chunks
          .map((c) => c.content)
          .join('\n---\n');
        contextSections.push(`=== Document: ${filename} ===\n${body}`);
      }
      const context = contextSections.join('\n\n');

      const systemPrompt = `You are a helpful assistant that answers questions by analyzing multiple documents.
The context below contains excerpts from ${docMap.size} document(s), each clearly separated by its filename.
Instructions:
- Answer using information from ALL relevant documents, not just one.
- If the question asks for data across multiple documents (e.g. "all names", "all salaries"), compile the answer from each document.
- Clearly attribute information to its source document when listing across multiple documents.
- Infer and summarize when needed — do not just quote verbatim.
- If a document does not contain relevant information for the question, skip it.
- If none of the documents contain relevant information, say "The documents do not appear to cover this topic."

Context:
${context}`;

      const response = await this.chat.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(question),
      ]);

      const answer = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const sources = [...docMap.entries()].flatMap(([filename, chunks]) =>
        chunks.map((c) => {
          const meta = c.metadata as ChunkMeta;
          return `${filename} (chunk ${meta?.chunkIndex ?? '?'})`;
        }),
      );

      return { answer, sources };
    } catch (err) {
      this.logger.error('Query failed', err);
      throw new InternalServerErrorException('Failed to process query');
    }
  }
}
