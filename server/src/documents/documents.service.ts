import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface DocumentSummary {
  filename: string;
  chunks: number;
  uploaded_at: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ── List all documents uploaded by this user ──────────────────────────────
  // Groups chunks by filename and returns one row per document.
  async listByUser(userId: number): Promise<DocumentSummary[]> {
    const result = await this.db.query<DocumentSummary>(
      `SELECT
         metadata->>'filename'  AS filename,
         COUNT(*)::int          AS chunks,
         MIN(created_at)        AS uploaded_at
       FROM documents
       WHERE user_id = $1
       GROUP BY metadata->>'filename'
       ORDER BY MIN(created_at) DESC`,
      [userId],
    );
    return result.rows as unknown as DocumentSummary[];
  }

  // ── Delete all chunks for a filename ─────────────────────────────────────
  // Returns the number of rows deleted.
  async deleteByFilename(userId: number, filename: string): Promise<number> {
    const result = await this.db.query(
      `DELETE FROM documents
       WHERE user_id = $1
         AND metadata->>'filename' = $2`,
      [userId, filename],
    );
    this.logger.log(
      `Deleted ${result.rowCount} chunks for "${filename}" (user ${userId})`,
    );
    return result.rowCount ?? 0;
  }
}
