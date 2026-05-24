import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryService } from './query.service';
import { DatabaseService } from '../database/database.service';

const mockEmbedDocuments = jest.fn().mockResolvedValue([new Array(3072).fill(0.1)]);
const mockChatInvoke = jest.fn().mockResolvedValue({ content: 'This document is about software.' });

jest.mock('@langchain/google-genai', () => ({
  GoogleGenerativeAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: mockEmbedDocuments,
  })),
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: mockChatInvoke,
  })),
}));

jest.mock('@langchain/core/messages', () => ({
  HumanMessage: jest.fn().mockImplementation((text) => ({ content: text })),
  SystemMessage: jest.fn().mockImplementation((text) => ({ content: text })),
}));

const mockDbRows = [
  { content: 'Software engineering principles.', metadata: { filename: 'doc.pdf', chunkIndex: 0 }, similarity: 0.95 },
  { content: 'Design patterns in practice.', metadata: { filename: 'doc.pdf', chunkIndex: 3 }, similarity: 0.88 },
];

const mockDb = {
  query: jest.fn().mockResolvedValue({ rows: mockDbRows }),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('mock-api-key'),
};

describe('QueryService', () => {
  let service: QueryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        { provide: DatabaseService, useValue: mockDb },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<QueryService>(QueryService);
    jest.clearAllMocks();

    mockEmbedDocuments.mockResolvedValue([new Array(3072).fill(0.1)]);
    mockChatInvoke.mockResolvedValue({ content: 'This document is about software.' });
    mockDb.query.mockResolvedValue({ rows: mockDbRows });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('answer()', () => {
    it('should return answer and sources', async () => {
      const result = await service.answer('What is this about?');

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
      expect(result.answer).toBe('This document is about software.');
    });

    it('should format sources with filename and chunk index', async () => {
      const result = await service.answer('What is this about?');

      expect(result.sources).toContain('doc.pdf (chunk 0)');
      expect(result.sources).toContain('doc.pdf (chunk 3)');
    });

    it('should embed the question before searching', async () => {
      await service.answer('What is this about?');

      expect(mockEmbedDocuments).toHaveBeenCalledWith(['What is this about?']);
    });

    it('should query the database with a vector literal', async () => {
      await service.answer('What is this about?');

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER  BY embedding <=>'),
        expect.arrayContaining([expect.stringMatching(/^\[/)]),
      );
    });

    it('should return no-documents message when DB has no rows', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.answer('What is this about?');

      expect(result.answer).toBe('No relevant documents found. Please upload a PDF first.');
      expect(result.sources).toHaveLength(0);
    });

    it('should not call the LLM when no documents are found', async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      await service.answer('What is this about?');

      expect(mockChatInvoke).not.toHaveBeenCalled();
    });

    it('should handle LLM returning non-string content', async () => {
      mockChatInvoke.mockResolvedValueOnce({ content: [{ text: 'structured response' }] });

      const result = await service.answer('What is this?');

      expect(typeof result.answer).toBe('string');
    });

    it('should fall back to content slice when metadata has no filename', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: [{ content: 'A very long chunk of text here that should be sliced', metadata: {}, similarity: 0.9 }],
      });

      const result = await service.answer('What is this?');

      expect(result.sources[0]).toBe('A very long chunk of text here that should be sliced');
    });

    it('should throw InternalServerErrorException when embedding fails', async () => {
      mockEmbedDocuments.mockRejectedValueOnce(new Error('Embedding API error'));

      await expect(service.answer('What is this?')).rejects.toThrow('Failed to process query');
    });

    it('should throw InternalServerErrorException type when embedding fails', async () => {
      mockEmbedDocuments.mockRejectedValueOnce(new Error('Embedding API error'));

      await expect(service.answer('What is this?')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when DB query fails', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('DB timeout'));

      await expect(service.answer('What is this?')).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException when LLM call fails', async () => {
      mockChatInvoke.mockRejectedValueOnce(new Error('LLM rate limit'));

      await expect(service.answer('What is this?')).rejects.toThrow(InternalServerErrorException);
    });
  });
});
