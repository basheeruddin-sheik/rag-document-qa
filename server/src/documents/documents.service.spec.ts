import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsService } from './documents.service';
import { DatabaseService } from '../database/database.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let db: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentsService,
        {
          provide: DatabaseService,
          useValue: { query: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    db = module.get(DatabaseService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('listByUser', () => {
    it('should return document summaries grouped by filename', async () => {
      const rows = [
        { filename: 'report.pdf', chunks: 10, uploaded_at: '2026-01-01' },
      ];
      db.query.mockResolvedValue({ rows } as any);

      const result = await service.listByUser(1);
      expect(result).toEqual(rows);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('GROUP BY'), [1]);
    });
  });

  describe('deleteByFilename', () => {
    it('should return count of deleted rows', async () => {
      db.query.mockResolvedValue({ rowCount: 5 } as any);

      const count = await service.deleteByFilename(1, 'report.pdf');
      expect(count).toBe(5);
    });

    it('should return 0 when no rows match', async () => {
      db.query.mockResolvedValue({ rowCount: 0 } as any);

      const count = await service.deleteByFilename(1, 'missing.pdf');
      expect(count).toBe(0);
    });
  });
});
