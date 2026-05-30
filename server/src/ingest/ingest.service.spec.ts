import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { DatabaseService } from '../database/database.service';

// Mock the heavy external modules so tests run fast with no real API calls
jest.mock('@langchain/google-genai', () => ({
  GoogleGenerativeAIEmbeddings: jest.fn().mockImplementation(() => ({
    // Return one vector per chunk — splitter mock returns 2 chunks, so we need 2 vectors
    embedDocuments: jest.fn().mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]),
  })),
}));

jest.mock('langchain/text_splitter', () => ({
  RecursiveCharacterTextSplitter: jest.fn().mockImplementation(() => ({
    splitText: jest.fn().mockResolvedValue(['chunk one', 'chunk two']),
  })),
}));

jest.mock('pdf-parse', () =>
  jest.fn().mockResolvedValue({ text: 'Sample PDF content for testing.' }),
);

describe('IngestService', () => {
  let service: IngestService;
  let db: jest.Mocked<DatabaseService>;

  const mockFile = {
    buffer: Buffer.from('fake pdf'),
    originalname: 'test.pdf',
    mimetype: 'application/pdf',
  } as Express.Multer.File;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestService,
        { provide: DatabaseService, useValue: { query: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('fake-api-key') },
        },
      ],
    }).compile();

    service = module.get<IngestService>(IngestService);
    db = module.get(DatabaseService);
    db.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('should return chunk count after ingestion', async () => {
    const count = await service.ingest(mockFile, 1);
    expect(count).toBe(2); // mocked splitter returns 2 chunks
    expect(db.query).toHaveBeenCalledTimes(2);
  });

  it('should throw InternalServerErrorException for empty PDF', async () => {
    const pdfParse = require('pdf-parse');
    pdfParse.mockResolvedValueOnce({ text: '   ' }); // whitespace only

    await expect(service.ingest(mockFile, 1)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
