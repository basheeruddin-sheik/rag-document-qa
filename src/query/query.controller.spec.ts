import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { QueryController } from './query.controller';
import { QueryService } from './query.service';

const mockQueryService = {
  answer: jest.fn(),
};

const mockAnswer = {
  answer: 'This document is about software engineering.',
  sources: ['doc.pdf (chunk 1)', 'doc.pdf (chunk 3)'],
};

describe('QueryController', () => {
  let controller: QueryController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueryController],
      providers: [{ provide: QueryService, useValue: mockQueryService }],
    }).compile();

    controller = module.get<QueryController>(QueryController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /query', () => {
    it('should return answer and sources', async () => {
      mockQueryService.answer.mockResolvedValue(mockAnswer);

      const result = await controller.query({ question: 'What is this about?' });

      expect(result).toEqual(mockAnswer);
      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
    });

    it('should pass trimmed question to QueryService', async () => {
      mockQueryService.answer.mockResolvedValue(mockAnswer);

      await controller.query({ question: '  What is this?  ' });

      expect(mockQueryService.answer).toHaveBeenCalledWith('What is this?');
    });

    it('should throw BadRequestException when question is missing', async () => {
      await expect(controller.query({} as any)).rejects.toThrow(BadRequestException);
      await expect(controller.query({} as any)).rejects.toThrow('question field is required');
    });

    it('should throw BadRequestException when question is empty string', async () => {
      await expect(controller.query({ question: '' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when question is only whitespace', async () => {
      await expect(controller.query({ question: '   ' })).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when body is null', async () => {
      await expect(controller.query(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should propagate errors from QueryService', async () => {
      mockQueryService.answer.mockRejectedValue(new Error('LLM timeout'));

      await expect(controller.query({ question: 'What is this?' })).rejects.toThrow('LLM timeout');
    });

    it('should return empty sources array when no documents are found', async () => {
      mockQueryService.answer.mockResolvedValue({
        answer: 'No relevant documents found. Please upload a PDF first.',
        sources: [],
      });

      const result = await controller.query({ question: 'What is this?' });

      expect(result.sources).toHaveLength(0);
    });
  });
});
