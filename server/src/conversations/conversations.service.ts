import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface ConversationRow {
  id: number;
  session_id: string;
  question: string;
  answer: string;
  sources: string[];
  created_at: Date;
}

export interface SessionSummary {
  session_id: string;
  title: string;        // first question in the session (used as display name)
  message_count: number;
  created_at: string;
  updated_at: string;
}

// How many past Q&A turns (within the SAME session) to feed to the AI as memory
const HISTORY_WINDOW = 5;

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly db: DatabaseService) {}

  // ── Save one Q&A turn (tagged with the session it belongs to) ─────────────
  async save(
    userId: number,
    sessionId: string,
    question: string,
    answer: string,
    sources: string[],
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO conversations (user_id, session_id, question, answer, sources)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, sessionId, question, answer, JSON.stringify(sources)],
    );
  }

  // ── Fetch recent history FROM THE SAME SESSION for AI context ─────────────
  // Only the current session's history is used — this keeps follow-ups focused
  // on the ongoing conversation, not unrelated previous chats.
  async getRecentHistory(userId: number, sessionId: string): Promise<ConversationRow[]> {
    const result = await this.db.query<ConversationRow>(
      `SELECT id, session_id, question, answer, sources, created_at
       FROM (
         SELECT id, session_id, question, answer, sources, created_at
         FROM conversations
         WHERE user_id = $1 AND session_id = $2
         ORDER BY created_at DESC
         LIMIT $3
       ) recent
       ORDER BY created_at ASC`,
      [userId, sessionId, HISTORY_WINDOW],
    );
    return result.rows as unknown as ConversationRow[];
  }

  // ── List all sessions for the history sidebar ─────────────────────────────
  // Groups individual Q&A rows by session_id.
  // Returns one summary per session — titled with the FIRST question asked.
  async getSessions(userId: number): Promise<SessionSummary[]> {
    const result = await this.db.query<SessionSummary>(
      `SELECT
         session_id,
         (ARRAY_AGG(question ORDER BY created_at ASC))[1]  AS title,
         COUNT(*)::int                                       AS message_count,
         MIN(created_at)                                     AS created_at,
         MAX(created_at)                                     AS updated_at
       FROM conversations
       WHERE user_id = $1
         AND session_id IS NOT NULL
       GROUP BY session_id
       ORDER BY MAX(created_at) DESC
       LIMIT 50`,
      [userId],
    );
    return result.rows as unknown as SessionSummary[];
  }

  // ── Fetch all Q&A turns in a specific session ──────────────────────────────
  async getBySessionId(userId: number, sessionId: string): Promise<ConversationRow[]> {
    const result = await this.db.query<ConversationRow>(
      `SELECT id, session_id, question, answer, sources, created_at
       FROM conversations
       WHERE user_id = $1 AND session_id = $2
       ORDER BY created_at ASC`,
      [userId, sessionId],
    );
    return result.rows as unknown as ConversationRow[];
  }

  // ── Clear ALL history for a user ──────────────────────────────────────────
  async clearByUser(userId: number): Promise<void> {
    await this.db.query(`DELETE FROM conversations WHERE user_id = $1`, [userId]);
    this.logger.log(`Cleared all conversation history for user ${userId}`);
  }
}
