import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DocumentsService } from './documents.service';

interface AuthReq extends Request {
  user: { id: number; email: string };
}

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all uploaded documents for the current user' })
  @ApiResponse({ status: 200, description: 'Array of document summaries' })
  list(@Req() req: AuthReq) {
    return this.docs.listByUser(req.user.id);
  }

  @Delete(':filename')
  @ApiOperation({ summary: 'Delete a document and all its chunks' })
  @ApiResponse({ status: 200, description: 'Deleted successfully' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async remove(
    @Param('filename') filename: string,
    @Req() req: AuthReq,
  ) {
    const deleted = await this.docs.deleteByFilename(
      req.user.id,
      decodeURIComponent(filename),
    );
    if (deleted === 0) throw new NotFoundException('Document not found');
    return { message: `Deleted "${filename}"`, chunks_removed: deleted };
  }
}
