import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IngestService } from './ingest.service';

interface AuthReq extends Request {
  user: { id: number; email: string };
}

@ApiTags('Ingest')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a PDF and ingest it into the vector store' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Chunks stored, count returned' })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(), // keep file in RAM — no disk writes
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Only PDF files are accepted'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB cap
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthReq,
  ): Promise<{ message: string; chunks: number }> {
    if (!file) throw new BadRequestException('No file provided');
    const chunks = await this.ingestService.ingest(file, req.user.id);
    return { message: 'Document ingested successfully', chunks };
  }
}
