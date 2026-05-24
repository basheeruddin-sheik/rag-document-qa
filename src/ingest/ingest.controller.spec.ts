import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

const mockIngestService = {
  ingest: jest.fn(),
};

const mockPdfFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'test.pdf',
  encoding: '7bit',
  mimetype: 'application/pdf',
  buffer: Buffer.from('mock pdf content'),
  size: 1024,
  stream: null as any,
  destination: '',
  filename: '',
  path: '',
  ...overrides,
});

describe('IngestController', () => {
  let controller: IngestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IngestController],
      providers: [{ provide: IngestService, useValue: mockIngestService }],
    }).compile();

    controller = module.get<IngestController>(IngestController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /upload', () => {
    it('should return success message with chunk count', async () => {
      mockIngestService.ingest.mockResolvedValue(23);

      const result = await controller.upload(mockPdfFile());

      expect(result).toEqual({ message: 'Document ingested successfully', chunks: 23 });
      expect(mockIngestService.ingest).toHaveBeenCalledTimes(1);
    });

    it('should pass the file to IngestService', async () => {
      mockIngestService.ingest.mockResolvedValue(10);
      const file = mockPdfFile({ originalname: 'my-doc.pdf' });

      await controller.upload(file);

      expect(mockIngestService.ingest).toHaveBeenCalledWith(file);
    });

    it('should throw BadRequestException when no file is provided', async () => {
      await expect(controller.upload(undefined as any)).rejects.toThrow(BadRequestException);
      await expect(controller.upload(undefined as any)).rejects.toThrow('No file provided');
    });

    it('should throw BadRequestException when file is null', async () => {
      await expect(controller.upload(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should propagate errors from IngestService', async () => {
      mockIngestService.ingest.mockRejectedValue(new Error('DB connection failed'));

      await expect(controller.upload(mockPdfFile())).rejects.toThrow('DB connection failed');
    });

    it('should return chunks as 0 when document has no content', async () => {
      mockIngestService.ingest.mockResolvedValue(0);

      const result = await controller.upload(mockPdfFile());

      expect(result.chunks).toBe(0);
    });
  });
});
