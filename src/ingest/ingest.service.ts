import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>;
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

    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 50,
    });
  }

  async ingest(file: Express.Multer.File): Promise<number> {
    try {
      const parsed = await pdfParse(file.buffer);
      const rawText = parsed.text;

      if (!rawText.trim()) {
        throw new InternalServerErrorException('PDF contains no extractable text');
      }

      const chunks = await this.splitter.splitText(rawText);
      this.logger.log(`Split into ${chunks.length} chunks from "${file.originalname}"`);

      const vectors = await this.embeddings.embedDocuments(chunks);

      for (let i = 0; i < chunks.length; i++) {
        const vector = `[${vectors[i].join(',')}]`;
        await this.db.query(
          `INSERT INTO documents (content, embedding, metadata)
           VALUES ($1, $2::vector, $3)`,
          [
            chunks[i],
            vector,
            JSON.stringify({ filename: file.originalname, chunkIndex: i }),
          ],
        );
      }

      this.logger.log(`Stored ${chunks.length} chunks from "${file.originalname}"`);
      return chunks.length;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error('Ingestion failed', err);
      throw new InternalServerErrorException('Failed to ingest document');
    }
  }
}
