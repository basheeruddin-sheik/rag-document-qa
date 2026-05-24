import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { IngestModule } from './ingest/ingest.module';
import { QueryModule } from './query/query.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    IngestModule,
    QueryModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
