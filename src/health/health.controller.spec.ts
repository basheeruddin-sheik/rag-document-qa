import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /health', () => {
    it('should return status ok', () => {
      expect(controller.check()).toEqual({ status: 'ok' });
    });

    it('should always return an object with a status field', () => {
      const result = controller.check();
      expect(result).toHaveProperty('status');
    });

    it('should return status as a string', () => {
      const result = controller.check();
      expect(typeof result.status).toBe('string');
    });
  });
});
