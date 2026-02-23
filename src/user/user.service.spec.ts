import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './entities/user.entity';
import { PointHistory, PointHistoryType } from './entities/point-history.entity';

const mockUserRepository = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const mockPointHistoryRepository = () => ({
  save: jest.fn(),
  create: jest.fn(),
});

const mockEntityManager = {
  createQueryBuilder: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn((cb) => cb(mockEntityManager)),
};

describe('UserService', () => {
  let service: UserService;
  let userRepository: ReturnType<typeof mockUserRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepository },
        { provide: getRepositoryToken(PointHistory), useFactory: mockPointHistoryRepository },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => jest.clearAllMocks());

  describe('getPoint', () => {
    it('존재하는 유저의 포인트 반환함', async () => {
      const user: Partial<User> = { id: 1, name: 'Test', point: 5000 };
      userRepository.findOne.mockResolvedValue(user);

      const result = await service.getPoint(1);

      expect(result).toEqual({ userId: 1, point: 5000 });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('존재하지 않는 유저는 NotFoundException 던짐', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getPoint(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('chargePoint', () => {
    it('포인트 정상 충전함', async () => {
      const user: Partial<User> = { id: 1, name: 'Test', point: 3000 };
      const queryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...user }),
      };
      mockEntityManager.createQueryBuilder.mockReturnValue(queryBuilder);
      mockEntityManager.save.mockResolvedValue({ ...user, point: 8000 });
      mockEntityManager.create.mockReturnValue({});
      mockDataSource.transaction.mockImplementation((cb) => cb(mockEntityManager));

      const result = await service.chargePoint({ userId: 1, amount: 5000 });

      expect(result.point).toBe(8000);
    });

    it('0 이하 금액 충전 시 BadRequestException 던짐', async () => {
      await expect(service.chargePoint({ userId: 1, amount: 0 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('존재하지 않는 유저 충전 시 NotFoundException 던짐', async () => {
      const queryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      mockEntityManager.createQueryBuilder.mockReturnValue(queryBuilder);
      mockDataSource.transaction.mockImplementation((cb) => cb(mockEntityManager));

      await expect(service.chargePoint({ userId: 999, amount: 1000 })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
