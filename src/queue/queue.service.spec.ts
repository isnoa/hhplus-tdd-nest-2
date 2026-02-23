import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { QueueService } from './queue.service';
import { QueueToken, QueueTokenStatus } from './entities/queue-token.entity';

const mockQueueTokenRepository = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('QueueService', () => {
  let service: QueueService;
  let repo: ReturnType<typeof mockQueueTokenRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        { provide: getRepositoryToken(QueueToken), useFactory: mockQueueTokenRepository },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
    repo = module.get(getRepositoryToken(QueueToken));
  });

  afterEach(() => jest.clearAllMocks());

  describe('issueToken', () => {
    it('활성 슬롯 있으면 ACTIVE 토큰 즉시 발급함', async () => {
      repo.findOne.mockResolvedValue(null); // no existing token
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.count.mockResolvedValue(5); // 5 active < 50
      const newToken: Partial<QueueToken> = {
        id: 1,
        userId: 1,
        token: 'test-uuid',
        status: QueueTokenStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        createdAt: new Date(),
      };
      repo.create.mockReturnValue(newToken);
      repo.save.mockResolvedValue(newToken);

      const result = await service.issueToken({ userId: 1 });

      expect(result.status).toBe(QueueTokenStatus.ACTIVE);
      expect(result.position).toBeNull();
    });

    it('활성 슬롯 없으면 WAITING 토큰 발급함', async () => {
      repo.findOne.mockResolvedValue(null);
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      repo.createQueryBuilder.mockReturnValue(qb);
      repo.count
        .mockResolvedValueOnce(50) // active count = max → create WAITING token
        .mockResolvedValueOnce(3); // waiting tokens ahead → position = 4
      const newToken: Partial<QueueToken> = {
        id: 10,
        userId: 2,
        token: 'waiting-uuid',
        status: QueueTokenStatus.WAITING,
        expiresAt: null,
        createdAt: new Date(),
      };
      repo.create.mockReturnValue(newToken);
      repo.save.mockResolvedValue(newToken);

      const result = await service.issueToken({ userId: 2 });

      expect(result.status).toBe(QueueTokenStatus.WAITING);
      expect(result.position).toBe(4);
    });

    it('기존 ACTIVE 토큰 있으면 재사용함', async () => {
      const existingToken: Partial<QueueToken> = {
        id: 5,
        userId: 1,
        token: 'existing-token',
        status: QueueTokenStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        createdAt: new Date(),
      };
      repo.findOne.mockResolvedValue(existingToken);

      const result = await service.issueToken({ userId: 1 });

      expect(result.token).toBe('existing-token');
      expect(result.status).toBe(QueueTokenStatus.ACTIVE);
      expect(repo.create).not.toHaveBeenCalled();
    });
  });

  describe('getQueueStatus', () => {
    it('존재하는 토큰의 상태 반환함', async () => {
      const token: Partial<QueueToken> = {
        token: 'abc-token',
        status: QueueTokenStatus.ACTIVE,
        expiresAt: new Date(),
        createdAt: new Date(),
      };
      repo.findOne.mockResolvedValue(token);

      const result = await service.getQueueStatus('abc-token');

      expect(result.token).toBe('abc-token');
      expect(result.status).toBe(QueueTokenStatus.ACTIVE);
    });

    it('존재하지 않는 토큰은 NotFoundException 던짐', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getQueueStatus('no-token')).rejects.toThrow(NotFoundException);
    });
  });
});
