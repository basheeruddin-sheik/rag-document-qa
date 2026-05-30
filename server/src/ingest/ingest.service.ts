import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (
  buffer: Buffer,
) => Promise<{ text: string }>;
import { DatabaseService } from '../database/database.service';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly embeddings: GoogleGenerativeAIEmbeddings;
  private readonly splitter: RecursiveCharacterTextSplitter;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: this.config.get<string>('GEMINI_API_KEY'),
      modelName: 'gemini-embedding-001',
    });

    // ── Sentence-aware chunking ─────────────────────────────────────────────
    // RecursiveCharacterTextSplitter tries each separator in order:
    //   1. \n\n  → split at paragraph breaks first (best boundary)
    //   2. \n    → split at line breaks
    //   3. '. '  → split at end of sentences
    //   4. '! '  → split at exclamations
    //   5. '? '  → split at questions
    //   6. ', '  → split at commas (last resort)
    //   7. ' '   → split at words (emergency)
    //   8. ''    → split at characters (absolute last resort)
    // This ensures chunks don't cut through sentences, preserving meaning.
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '. ', '! ', '? ', ', ', ' ', ''],
    });
  }

  async ingest(file: Express.Multer.File, userId: number): Promise<number> {
    try {
      const parsed = await pdfParse(file.buffer);
      const rawText = parsed.text;

      if (!rawText.trim()) {
        throw new InternalServerErrorException(
          'PDF contains no extractable text',
        );
      }

      const chunks = await this.splitter.splitText(rawText);
      this.logger.log(
        `Split "${file.originalname}" into ${chunks.length} chunks`,
      );

      // Batch-embed all chunks in one API call (more efficient than one-by-one)
      const vectors = await this.embeddings.embedDocuments(chunks);

      // Insert each chunk with its embedding and the uploader's userId
      for (let i = 0; i < chunks.length; i++) {
        const vector = `[${vectors[i].join(',')}]`;
        await this.db.query(
          `INSERT INTO documents (user_id, content, embedding, metadata)
           VALUES ($1, $2, $3::halfvec, $4)`,
          [
            userId,
            chunks[i],
            vector,
            JSON.stringify({ filename: file.originalname, chunkIndex: i }),
          ],
        );
      }

      this.logger.log(
        `Stored ${chunks.length} chunks from "${file.originalname}" (user ${userId})`,
      );
      return chunks.length;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error('Ingestion failed', err);
      throw new InternalServerErrorException('Failed to ingest document');
    }
  }
}
