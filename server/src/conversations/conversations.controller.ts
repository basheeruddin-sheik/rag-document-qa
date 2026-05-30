import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversationsService } from './conversations.service';

interface AuthReq extends Request {
  user: { id: number; email: string };
}

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly convs: ConversationsService) {}

  // ── GET /conversations/sessions — list one entry per chat session ──────────
  @Get('sessions')
  @ApiOperation({ summary: 'List chat sessions (one per "New Chat" click)' })
  listSessions(@Req() req: AuthReq) {
    return this.convs.getSessions(req.user.id);
  }

  // ── GET /conversations/sessions/:id — all messages in one session ──────────
  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Get all messages in a specific session' })
  getSession(@Param('sessionId') sessionId: string, @Req() req: AuthReq) {
    return this.convs.getBySessionId(req.user.id, sessionId);
  }

  // ── DELETE /conversations — wipe all history ───────────────────────────────
  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear all conversation history' })
  @ApiResponse({ status: 200 })
  async clear(@Req() req: AuthReq) {
    await this.convs.clearByUser(req.user.id);
    return { message: 'Conversation history cleared' };
  }
}
