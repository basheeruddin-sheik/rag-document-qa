import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { IngestModule } from './ingest/ingest.module';
import { QueryModule } from './query/query.module';
import { DocumentsModule } from './documents/documents.module';
import { ConversationsModule } from './conversations/conversations.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // ── Config: load .env globally ──────────────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Rate limiting: 100 req / 60 s per IP ───────────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),

    // ── Feature modules ─────────────────────────────────────────────────────
    DatabaseModule,
    AuthModule,
    UsersModule,
    IngestModule,
    QueryModule,
    DocumentsModule,
    ConversationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
