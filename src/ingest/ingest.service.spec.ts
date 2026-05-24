import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IngestService } from './ingest.service';
import { DatabaseService } from '../database/database.service';

jest.mock('@langchain/google-genai', () => ({
  GoogleGenerativeAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn().mockResolvedValue([
      new Array(3072).fill(0.1),
      new Array(3072).fill(0.2),
    ]),
  })),
}));

jest.mock('langchain/text_splitter', () => ({
  RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
    splitText: jest.fn().mockResolvedValue(['chunk one', 'chunk two']),
  })),
}));

jest.mock('pdf-parse', () =>
  jest.fn().mockResolvedValue({ text: 'Sample PDF text content' }),
);

const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('mock-api-key'),
};

const mockPdfFile = (): Express.Multer.File => ({
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
});

describe('IngestService', () => {
  let service: IngestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<IngestService>(IngestService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('ingest()', () => {
    it('should return the number of chunks stored', async () => {
      const result = await service.ingest(mockPdfFile());
      expect(result).toBe(2);
    });

    it('should call db.query once per chunk', async () => {
      await service.ingest(mockPdfFile());
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });

    it('should insert content, embedding vector and metadata into db', async () => {
      await service.ingest(mockPdfFile());

      const firstCall = mockDb.query.mock.calls[0];
      expect(firstCall[0]).toContain('INSERT INTO documents');
      expect(firstCall[1][0]).toBe('chunk one');
      expect(firstCall[1][1]).toMatch(/^\[/);
      expect(JSON.parse(firstCall[1][2])).toMatchObject({
        filename: 'test.pdf',
        chunkIndex: 0,
      });
    });

    it('should throw InternalServerErrorException when PDF has no text', async () => {
      const pdfParse = require('pdf-parse');
      pdfParse.mockResolvedValueOnce({ text: '   ' });

      await expect(service.ingest(mockPdfFile())).rejects.toThrow('PDF contains no extractable text');
    });

    it('should throw InternalServerErrorException type when PDF has no text', async () => {
      const pdfParse = require('pdf-parse');
      pdfParse.mockResolvedValueOnce({ text: '   ' });

      await expect(service.ingest(mockPdfFile())).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when db.query fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.ingest(mockPdfFile())).rejects.toThrow('Failed to ingest document');
    });

    it('should throw InternalServerErrorException type when db.query fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB error'));

      await expect(service.ingest(mockPdfFile())).rejects.toThrow(InternalServerErrorException);
    });

    it('should store chunkIndex correctly for each chunk', async () => {
      await service.ingest(mockPdfFile());

      const call0Meta = JSON.parse(mockDb.query.mock.calls[0][1][2]);
      const call1Meta = JSON.parse(mockDb.query.mock.calls[1][1][2]);
      expect(call0Meta.chunkIndex).toBe(0);
      expect(call1Meta.chunkIndex).toBe(1);
    });
  });
});
