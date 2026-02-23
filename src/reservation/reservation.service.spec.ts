import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReservationService } from './reservation.service';
import { Reservation, ReservationStatus, TEMP_RESERVATION_MINUTES } from './entities/reservation.entity';
import { Seat, SeatStatus } from '../concert/entities/seat.entity';
import { ConcertSchedule } from '../concert/entities/concert-schedule.entity';

const mockReservationRepo = () => ({ findOne: jest.fn() });
const mockSeatRepo = () => ({});
const mockScheduleRepo = () => ({});

const buildManager = (overrides: Partial<any> = {}) => ({
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  ...overrides,
});

const mockDataSource = { transaction: jest.fn() };

describe('ReservationService', () => {
  let service: ReservationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        { provide: getRepositoryToken(Reservation), useFactory: mockReservationRepo },
        { provide: getRepositoryToken(Seat), useFactory: mockSeatRepo },
        { provide: getRepositoryToken(ConcertSchedule), useFactory: mockScheduleRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('createReservation', () => {
    it('정상적으로 좌석 예약함', async () => {
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      const schedule: Partial<ConcertSchedule> = { id: 1, concertDate: '2026-03-01' };
      const seat: Partial<Seat> = {
        id: 10,
        seatNumber: 5,
        status: SeatStatus.AVAILABLE,
        tempReservedUntil: null,
      };
      const reservation = {
        id: 100,
        userId: 1,
        seatId: 10,
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() + TEMP_RESERVATION_MINUTES * 60 * 1000),
      } as any;

      manager.findOne.mockResolvedValueOnce(schedule);
      const seatQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...seat }),
      };
      manager.createQueryBuilder.mockReturnValue(seatQb);
      manager.save.mockResolvedValue(seat);
      manager.create.mockReturnValue(reservation);
      manager.save.mockResolvedValue(reservation);

      const result = await service.createReservation(1, {
        concertScheduleId: 1,
        seatNumber: 5,
      });

      expect(result.status).toBe(ReservationStatus.PENDING);
    });

    it('이미 예약된 좌석에 예약 시 ConflictException 던짐', async () => {
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      manager.findOne.mockResolvedValueOnce({ id: 1 });
      const seatQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 10,
          seatNumber: 5,
          status: SeatStatus.RESERVED,
        }),
      };
      manager.createQueryBuilder.mockReturnValue(seatQb);

      await expect(
        service.createReservation(1, { concertScheduleId: 1, seatNumber: 5 }),
      ).rejects.toThrow(ConflictException);
    });

    it('존재하지 않는 일정에 예약 시 NotFoundException 던짐', async () => {
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));
      manager.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createReservation(1, { concertScheduleId: 999, seatNumber: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
