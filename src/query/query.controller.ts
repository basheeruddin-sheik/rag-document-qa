import { Body, Controller, Post, BadRequestException } from '@nestjs/common';
import { QueryService } from './query.service';

interface QueryDto {
  question: string;
}

interface QueryResponse {
  answer: string;
  sources: string[];
}

@Controller()
export class QueryController {
  constructor(private readonly queryService: QueryService) {}

  @Post('query')
  async query(@Body() body: QueryDto): Promise<QueryResponse> {
    if (!body?.question?.trim()) {
      throw new BadRequestException('question field is required');
    }
    return this.queryService.answer(body.question.trim());
  }
}
