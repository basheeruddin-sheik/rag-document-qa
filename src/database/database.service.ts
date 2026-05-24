import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({ connectionString: this.config.get<string>('DATABASE_URL') });

    try {
      await this.pool.query('SELECT 1');
      this.logger.log('Database connected');
      await this.initSchema();
    } catch (err) {
      this.logger.warn(`Database not reachable at startup: ${(err as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<QueryResult<T & Record<string, unknown>>> {
    return this.pool.query<T & Record<string, unknown>>(sql, params);
  }

  private async initSchema(): Promise<void> {
    await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id         serial PRIMARY KEY,
        content    text NOT NULL,
        embedding  vector(3072) NOT NULL,
        metadata   jsonb,
        created_at timestamp DEFAULT now()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS documents_embedding_idx
      ON documents USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
    this.logger.log('Schema initialized');
  }
}
