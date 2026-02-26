import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ConcertService } from './concert.service';
import { Concert } from './entities/concert.entity';
import { ConcertSchedule } from './entities/concert-schedule.entity';
import { Seat, SeatStatus } from './entities/seat.entity';

const mockConcertRepo = () => ({ findOne: jest.fn() });
const mockScheduleRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
});
const mockSeatRepo = () => ({
  find: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ConcertService', () => {
  let service: ConcertService;
  let concertRepo: ReturnType<typeof mockConcertRepo>;
  let scheduleRepo: ReturnType<typeof mockScheduleRepo>;
  let seatRepo: ReturnType<typeof mockSeatRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConcertService,
        { provide: getRepositoryToken(Concert), useFactory: mockConcertRepo },
        { provide: getRepositoryToken(ConcertSchedule), useFactory: mockScheduleRepo },
        { provide: getRepositoryToken(Seat), useFactory: mockSeatRepo },
      ],
    }).compile();

    service = module.get<ConcertService>(ConcertService);
    concertRepo = module.get(getRepositoryToken(Concert));
    scheduleRepo = module.get(getRepositoryToken(ConcertSchedule));
    seatRepo = module.get(getRepositoryToken(Seat));
  });

  afterEach(() => jest.clearAllMocks());

  describe('getAvailableDates', () => {
    it('콘서트 없으면 NotFoundException 던짐', async () => {
      concertRepo.findOne.mockResolvedValue(null);

      await expect(service.getAvailableDates(999)).rejects.toThrow(NotFoundException);
    });

    it('예약 가능한 일정만 반환함', async () => {
      concertRepo.findOne.mockResolvedValue({ id: 1, name: 'Test Concert' });
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      seatRepo.createQueryBuilder.mockReturnValue(qb);
      const schedules = [
        { id: 1, concertDate: '2026-03-01' },
        { id: 2, concertDate: '2026-03-15' },
      ];
      scheduleRepo.find.mockResolvedValue(schedules);
      // 일정 1은 예약 가능한 좌석 없음, 일정 2는 좌석 있음
      seatRepo.count
        .mockResolvedValueOnce(0)  // schedule 1
        .mockResolvedValueOnce(10); // schedule 2

      const result = await service.getAvailableDates(1);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2);
    });
  });

  describe('getAvailableSeats', () => {
    it('일정 없으면 NotFoundException 던짐', async () => {
      scheduleRepo.findOne.mockResolvedValue(null);

      await expect(service.getAvailableSeats(999)).rejects.toThrow(NotFoundException);
    });

    it('AVAILABLE 좌석만 반환함', async () => {
      scheduleRepo.findOne.mockResolvedValue({ id: 1 });
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({}),
      };
      seatRepo.createQueryBuilder.mockReturnValue(qb);
      const seats = [
        { id: 1, seatNumber: 1, status: SeatStatus.AVAILABLE },
        { id: 2, seatNumber: 2, status: SeatStatus.AVAILABLE },
      ];
      seatRepo.find.mockResolvedValue(seats);

      const result = await service.getAvailableSeats(1);

      expect(result).toHaveLength(2);
      expect(result[0].seatNumber).toBe(1);
    });
  });
});
