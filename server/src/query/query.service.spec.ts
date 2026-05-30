import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { QueryService } from './query.service';
import { DatabaseService } from '../database/database.service';
import { ConversationsService } from '../conversations/conversations.service';

jest.mock('@langchain/google-genai', () => ({
  GoogleGenerativeAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn().mockResolvedValue([[0.1, 0.2]]),
  })),
  ChatGoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({ content: 'John earns $5,000.' }),
    stream: jest.fn().mockImplementation(async function* () {
      yield { content: 'John ' };
      yield { content: 'earns $5,000.' };
    }),
  })),
}));

describe('QueryService', () => {
  let service: QueryService;
  let db: jest.Mocked<DatabaseService>;
  let convs: jest.Mocked<ConversationsService>;

  const mockSimilarityRows = [
    {
      content: 'John earns $5,000 per month.',
      metadata: { filename: 'hr.pdf', chunkIndex: 1 },
      similarity: 0.9,
    },
  ];

  const mockHeaderRows = [
    {
      content: 'HR Report 2024',
      metadata: { filename: 'hr.pdf', chunkIndex: 0 },
      similarity: 1,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        {
          provide: DatabaseService,
          useValue: { query: jest.fn() },
        },
        {
          provide: ConversationsService,
          useValue: {
            getRecentHistory: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('fake-api-key') },
        },
      ],
    }).compile();

    service = module.get<QueryService>(QueryService);
    db = module.get(DatabaseService);
    convs = module.get(ConversationsService);

    // First query call → similarity results; second → header results
    db.query
      .mockResolvedValueOnce({ rows: mockSimilarityRows } as any)
      .mockResolvedValueOnce({ rows: mockHeaderRows } as any);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('should return answer and sources for a valid question', async () => {
    const result = await service.answer("What is John's salary?", 1, 'test-session');

    expect(result.answer).toBe('John earns $5,000.');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(convs.save).toHaveBeenCalledWith(
      1,
      'test-session',
      "What is John's salary?",
      'John earns $5,000.',
      expect.any(Array),
    );
  });

  it('should return no-document message when DB is empty', async () => {
    // Reset the queue set up by beforeEach so our empty responses are used
    db.query.mockReset();
    db.query
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const result = await service.answer('anything?', 1, 'test-session');
    expect(result.answer).toMatch(/No relevant documents/i);
  });
});
