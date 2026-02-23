import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { ReservationService } from '../reservation/reservation.service';
import { UserService } from '../user/user.service';
import { QueueService } from '../queue/queue.service';
import { Reservation, ReservationStatus } from '../reservation/entities/reservation.entity';
import { ConcertSchedule } from '../concert/entities/concert-schedule.entity';

const mockPaymentRepo = () => ({});

const mockReservationService = {
  confirmReservation: jest.fn(),
};
const mockUserService = {
  deductPoint: jest.fn(),
};
const mockQueueService = {
  expireToken: jest.fn(),
};

const buildManager = (overrides: Partial<any> = {}) => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  ...overrides,
});

const mockDataSource = { transaction: jest.fn() };

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getRepositoryToken(Payment), useFactory: mockPaymentRepo },
        { provide: ReservationService, useValue: mockReservationService },
        { provide: UserService, useValue: mockUserService },
        { provide: QueueService, useValue: mockQueueService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('processPayment', () => {
    it('정상 결제 처리함', async () => {
      const manager = buildManager();
      const reservation = {
        id: 1,
        userId: 1,
        concertScheduleId: 1,
        status: ReservationStatus.CONFIRMED,
      } as any;
      const schedule: Partial<ConcertSchedule> = { id: 1, price: 50000 };
      const payment: Partial<Payment> = { id: 1, userId: 1, reservationId: 1, amount: 50000 };

      mockReservationService.confirmReservation.mockResolvedValue(reservation);
      manager.findOne.mockResolvedValue(schedule);
      mockUserService.deductPoint.mockResolvedValue(undefined);
      manager.create.mockReturnValue(payment);
      manager.save.mockResolvedValue(payment);
      mockQueueService.expireToken.mockResolvedValue(undefined);

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const result = await cb(manager);
        return result;
      });

      const result = await service.processPayment(1, 'test-token', { reservationId: 1 });

      expect(result.amount).toBe(50000);
      expect(mockQueueService.expireToken).toHaveBeenCalledWith('test-token');
    });

    it('결제 시 일정을 찾지 못하면 NotFoundException 던짐', async () => {
      const manager = buildManager();
      const reservation = {
        id: 1,
        userId: 1,
        concertScheduleId: 999,
        status: ReservationStatus.CONFIRMED,
      } as any;

      mockReservationService.confirmReservation.mockResolvedValue(reservation);
      manager.findOne.mockResolvedValue(null); // schedule not found

      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      await expect(
        service.processPayment(1, 'test-token', { reservationId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
