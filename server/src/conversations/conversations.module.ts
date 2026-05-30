import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';

@Module({
  providers: [ConversationsService],
  exports: [ConversationsService],
  controllers: [ConversationsController],
})
export class ConversationsModule {}
