import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      connectionString: this.config.get<string>('DATABASE_URL'),
    });

    try {
      await this.pool.query('SELECT 1');
      this.logger.log('Database connected');
      await this.initSchema();
    } catch (err) {
      this.logger.warn(
        `Database not reachable at startup: ${(err as Error).message}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T = unknown>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T & Record<string, unknown>>> {
    return this.pool.query<T & Record<string, unknown>>(sql, params);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Schema initialisation
  //  Creates all tables & indexes on first start. Safe to run multiple times.
  // ─────────────────────────────────────────────────────────────────────────
  private async initSchema(): Promise<void> {
    // ── pgvector extension ──────────────────────────────────────────────────
    await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // ── users ───────────────────────────────────────────────────────────────
    // Stores registered accounts. password_hash is a bcrypt hash — never plain text.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            serial PRIMARY KEY,
        email         varchar(255) UNIQUE NOT NULL,
        password_hash text NOT NULL,
        created_at    timestamp DEFAULT now()
      )
    `);

    // ── documents ───────────────────────────────────────────────────────────
    // Each row = one text chunk from a PDF + its vector embedding.
    // user_id links the chunk to the uploader so each user sees only their docs.
    //
    // WHY halfvec(3072) not vector(3072)?
    // pgvector's standard `vector` type supports indexes only up to 2000 dims.
    // `halfvec` stores each float in 16-bit (half precision) instead of 32-bit,
    // allowing up to 16000 dims with HNSW indexes. Accuracy loss is < 0.1%
    // for cosine similarity, which is negligible in practice.
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id         serial PRIMARY KEY,
        user_id    integer REFERENCES users(id) ON DELETE CASCADE,
        content    text NOT NULL,
        embedding  halfvec(3072) NOT NULL,
        metadata   jsonb,
        created_at timestamp DEFAULT now()
      )
    `);

    // HNSW index — Hierarchical Navigable Small World graph.
    // Works with halfvec up to 16000 dims (unlike ivfflat which caps at 2000).
    // m = max graph connections per node  (16 = good speed/accuracy balance).
    // ef_construction = candidate list size during build (64 = fast, good recall).
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS documents_embedding_idx
      ON documents USING hnsw (embedding halfvec_cosine_ops)
      WITH (m = 16, ef_construction = 64)
    `);

    // Index for fast per-user document lookups
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS documents_user_id_idx
      ON documents(user_id)
    `);

    // ── conversations ────────────────────────────────────────────────────────
    // Each row = one Q&A exchange.
    // session_id groups multiple Q&A turns into ONE chat session.
    // All messages typed before "New Chat" share the same session_id.
    // This lets the AI understand follow-ups ("what about him?")
    // AND lets the sidebar show one entry per session (not one per message).
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id         serial PRIMARY KEY,
        user_id    integer REFERENCES users(id) ON DELETE CASCADE,
        session_id varchar(36),
        question   text NOT NULL,
        answer     text NOT NULL,
        sources    jsonb,
        created_at timestamp DEFAULT now()
      )
    `);

    // Safe migration: add session_id to existing tables that pre-date this column
    await this.pool.query(`
      ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_id varchar(36)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS conversations_user_id_idx ON conversations(user_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS conversations_session_id_idx ON conversations(session_id)
    `);

    this.logger.log('Schema initialised (users, documents, conversations)');
  }
}
