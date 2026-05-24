import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';

const mockQuery = jest.fn();
const mockEnd = jest.fn().mockResolvedValue(undefined);

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockQuery,
    end: mockEnd,
  })),
}));

const mockConfig = {
  get: jest.fn().mockReturnValue('postgresql://postgres:postgres@localhost:5432/ragdb'),
};

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Simulate successful DB connection and schema init
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // SELECT 1 (ping)
      .mockResolvedValueOnce({ rows: [] }) // CREATE EXTENSION
      .mockResolvedValueOnce({ rows: [] }) // CREATE TABLE
      .mockResolvedValueOnce({ rows: [] }); // CREATE INDEX

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit()', () => {
    it('should ping the database on init', () => {
      expect(mockQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('should create the vector extension', () => {
      expect(mockQuery).toHaveBeenCalledWith('CREATE EXTENSION IF NOT EXISTS vector');
    });

    it('should create the documents table', () => {
      const calls = mockQuery.mock.calls.map((c) => c[0] as string);
      expect(calls.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS documents'))).toBe(true);
    });

    it('should create the ivfflat index', () => {
      const calls = mockQuery.mock.calls.map((c) => c[0] as string);
      expect(calls.some((sql) => sql.includes('ivfflat'))).toBe(true);
    });

    it('should warn and continue when DB is not reachable', async () => {
      jest.clearAllMocks();
      mockQuery.mockRejectedValueOnce(new Error('Connection refused'));

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DatabaseService,
          { provide: ConfigService, useValue: mockConfig },
        ],
      }).compile();

      const newService = module.get<DatabaseService>(DatabaseService);
      await expect(newService.onModuleInit()).resolves.not.toThrow();
    });
  });

  describe('onModuleDestroy()', () => {
    it('should close the pool on destroy', async () => {
      await service.onModuleDestroy();
      expect(mockEnd).toHaveBeenCalled();
    });
  });

  describe('query()', () => {
    it('should execute a SQL query and return results', async () => {
      const mockRows = [{ id: 1, content: 'test' }];
      mockQuery.mockResolvedValueOnce({ rows: mockRows });

      const result = await service.query('SELECT * FROM documents');

      expect(result.rows).toEqual(mockRows);
    });

    it('should pass parameters to the query', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.query('SELECT * FROM documents WHERE id = $1', [42]);

      expect(mockQuery).toHaveBeenCalledWith('SELECT * FROM documents WHERE id = $1', [42]);
    });

    it('should default params to empty array', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await service.query('SELECT 1');

      expect(mockQuery).toHaveBeenCalledWith('SELECT 1', []);
    });

    it('should propagate DB errors', async () => {
      mockQuery.mockRejectedValueOnce(new Error('syntax error'));

      await expect(service.query('INVALID SQL')).rejects.toThrow('syntax error');
    });
  });
});
