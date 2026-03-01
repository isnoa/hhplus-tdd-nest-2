import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { PaymentService } from "./payment.service";
import { Payment } from "./entities/payment.entity";
import { ReservationService } from "../reservation/reservation.service";
import { UserService } from "../user/user.service";
import { QueueService } from "../queue/queue.service";
import {
  Reservation,
  ReservationStatus,
} from "../reservation/entities/reservation.entity";
import { ConcertSchedule } from "../concert/entities/concert-schedule.entity";

/**
 * PaymentService 레이어드 아키텍처 테스트
 * 레이어드 아키텍처: 모든 외부 의존성(Repository, Service 등)을 Mock으로 대체
 * 결제 로직의 순서 및 각 의존성 호출 검증
 */

// Mock Factory 함수들
const mockPaymentRepo = () => ({
  save: jest.fn(),
  findOne: jest.fn(),
});

// 각 Service Mock 정의
const mockReservationService = {
  confirmReservation: jest.fn(),
  findById: jest.fn(),
};

const mockUserService = {
  deductPoint: jest.fn(),
  getPoint: jest.fn(),
};

const mockQueueService = {
  expireToken: jest.fn(),
  getQueueToken: jest.fn(),
};

// Transaction Manager Mock 빌더
const buildManager = (overrides: Partial<any> = {}) => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  ...overrides,
});

// DataSource Mock
const mockDataSource = { transaction: jest.fn() };

describe("PaymentService - 레이어드 아키텍처 테스트", () => {
  let service: PaymentService;
  let mockPaymentRepository: any;

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
    mockPaymentRepository = module.get(getRepositoryToken(Payment));
  });

  afterEach(() => jest.clearAllMocks());

  describe("processPayment - 성공 시나리오", () => {
    it("정상적으로 결제를 처리해야 한다", async () => {
      // Given: 테스트 데이터
      const userId = 1;
      const reservationId = 1;
      const queueToken = "test-queue-token";
      const concertScheduleId = 1;
      const price = 50000;

      const manager = buildManager();

      // Mock 설정: 예약 확정
      const reservation = {
        id: reservationId,
        userId,
        concertScheduleId,
        status: ReservationStatus.CONFIRMED,
      } as any;
      mockReservationService.confirmReservation.mockResolvedValue(reservation);

      // Mock 설정: 콘서트 일정 조회
      const schedule: Partial<ConcertSchedule> = {
        id: concertScheduleId,
        price,
      };
      manager.findOne.mockResolvedValue(schedule);

      // Mock 설정: 포인트 차감
      mockUserService.deductPoint.mockResolvedValue(undefined);

      // Mock 설정: 결제 생성 및 저장
      const payment: Partial<Payment> = {
        id: 1,
        userId,
        reservationId,
        amount: price,
      };
      manager.create.mockReturnValue(payment);
      manager.save.mockResolvedValue(payment);

      // Mock 설정: 대기열 토큰 만료
      mockQueueService.expireToken.mockResolvedValue(undefined);

      // Transaction 콜백 설정
      mockDataSource.transaction.mockImplementation(async (cb) => {
        const result = await cb(manager);
        return result;
      });

      // When: 결제 처리
      const result = await service.processPayment(userId, queueToken, {
        reservationId,
      });

      // Then: 결과 검증
      expect(result.amount).toBe(price);
      expect(result.userId).toBe(userId);
      expect(result.reservationId).toBe(reservationId);

      // Mock 호출 검증: 모든 의존성이 올바르게 호출되었는지 확인
      expect(mockReservationService.confirmReservation).toHaveBeenCalledWith(
        reservationId,
        userId,
        manager,
      );
      expect(manager.findOne).toHaveBeenCalledWith(
        ConcertSchedule,
        expect.any(Object),
      );
      expect(mockUserService.deductPoint).toHaveBeenCalledWith(
        userId,
        price,
        manager,
      );
      expect(manager.create).toHaveBeenCalled();
      expect(manager.save).toHaveBeenCalled();
      expect(mockQueueService.expireToken).toHaveBeenCalledWith(queueToken);
    });
  });

  describe("processPayment - 예약 검증 실패", () => {
    it("예약을 확정하지 못하면 에러를 throw해야 한다", async () => {
      // Given: 예약 확정 실패
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      mockReservationService.confirmReservation.mockRejectedValue(
        new Error("예약이 없습니다."),
      );

      // When & Then
      await expect(
        service.processPayment(1, "test-token", { reservationId: 999 }),
      ).rejects.toThrow("예약이 없습니다.");
    });
  });

  describe("processPayment - 콘서트 일정 검증 실패", () => {
    it("콘서트 일정을 찾지 못하면 NotFoundException을 throw해야 한다", async () => {
      // Given: 콘서트 일정 없음
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

      // When & Then
      await expect(
        service.processPayment(1, "test-token", { reservationId: 1 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("processPayment - 비즈니스 로직 검증", () => {
    it("포인트가 올바른 금액대로 차감되어야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 1;
      const concertScheduleId = 1;
      const price = 75000; // 특정 금액

      const manager = buildManager();

      const reservation = {
        id: reservationId,
        userId,
        concertScheduleId,
        status: ReservationStatus.CONFIRMED,
      } as any;

      const schedule: Partial<ConcertSchedule> = {
        id: concertScheduleId,
        price,
      };
      const payment: Partial<Payment> = {
        id: 1,
        userId,
        reservationId,
        amount: price,
      };

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

      // When
      await service.processPayment(userId, "test-token", { reservationId });

      // Then: 정확한 금액이 차감되었는지 검증
      expect(mockUserService.deductPoint).toHaveBeenCalledWith(
        userId,
        price,
        manager,
      );
      expect(mockUserService.deductPoint).toHaveBeenCalledTimes(1);
    });

    it("대기열 토큰이 반드시 만료되어야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 1;
      const queueToken = "specific-queue-token-123";

      const manager = buildManager();

      const reservation = {
        id: reservationId,
        userId,
        concertScheduleId: 1,
        status: ReservationStatus.CONFIRMED,
      } as any;

      const schedule: Partial<ConcertSchedule> = { id: 1, price: 50000 };
      const payment: Partial<Payment> = {
        id: 1,
        userId,
        reservationId,
        amount: 50000,
      };

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

      // When
      await service.processPayment(userId, queueToken, { reservationId });

      // Then: 정확한 토큰이 만료되었는지 검증
      expect(mockQueueService.expireToken).toHaveBeenCalledWith(queueToken);
      expect(mockQueueService.expireToken).toHaveBeenCalledTimes(1);
    });

    it("트랜잭션 내에서 모든 작업이 실행되어야 한다", async () => {
      // Given: transaction wrapper가 호출되었는지 확인
      const manager = buildManager();
      let transactionCalled = false;

      mockDataSource.transaction.mockImplementation(async (cb) => {
        transactionCalled = true;
        const result = await cb(manager);
        return result;
      });

      const reservation = {
        id: 1,
        userId: 1,
        concertScheduleId: 1,
        status: ReservationStatus.CONFIRMED,
      } as any;

      const schedule: Partial<ConcertSchedule> = { id: 1, price: 50000 };
      const payment: Partial<Payment> = {
        id: 1,
        userId: 1,
        reservationId: 1,
        amount: 50000,
      };

      mockReservationService.confirmReservation.mockResolvedValue(reservation);
      manager.findOne.mockResolvedValue(schedule);
      mockUserService.deductPoint.mockResolvedValue(undefined);
      manager.create.mockReturnValue(payment);
      manager.save.mockResolvedValue(payment);
      mockQueueService.expireToken.mockResolvedValue(undefined);

      // When
      await service.processPayment(1, "test-token", { reservationId: 1 });

      // Then: transaction이 호출되었는지 확인
      expect(transactionCalled).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it("각 단계가 올바른 순서로 실행되어야 한다", async () => {
      // Given: 호출 순서를 추적
      const callOrder: string[] = [];
      const manager = buildManager();

      mockDataSource.transaction.mockImplementation(async (cb) => {
        const result = await cb(manager);
        return result;
      });

      mockReservationService.confirmReservation.mockImplementation(async () => {
        callOrder.push("confirmReservation");
        return { id: 1, userId: 1, concertScheduleId: 1 };
      });

      manager.findOne.mockImplementation(async () => {
        callOrder.push("findSchedule");
        return { id: 1, price: 50000 };
      });

      mockUserService.deductPoint.mockImplementation(async () => {
        callOrder.push("deductPoint");
      });

      manager.create.mockImplementation((entity, data) => {
        callOrder.push("createPayment");
        return data;
      });

      manager.save.mockImplementation(async (data) => {
        callOrder.push("savePayment");
        return data;
      });

      mockQueueService.expireToken.mockImplementation(async () => {
        callOrder.push("expireToken");
      });

      // When
      await service.processPayment(1, "test-token", { reservationId: 1 });

      // Then: 호출 순서 검증
      // 예약 확정 -> 일정 조회 -> 포인트 차감 -> 결제 생성 -> 결제 저장 -> 토큰 만료
      expect(callOrder).toContain("confirmReservation");
      expect(callOrder).toContain("findSchedule");
      expect(callOrder).toContain("deductPoint");
      expect(callOrder).toContain("createPayment");
      expect(callOrder).toContain("savePayment");
      expect(callOrder).toContain("expireToken");

      // 일정 조회는 포인트 차감 전에 발생
      expect(callOrder.indexOf("findSchedule")).toBeLessThan(
        callOrder.indexOf("deductPoint"),
      );

      // 포인트 차감은 결제 저장 전에 발생
      expect(callOrder.indexOf("deductPoint")).toBeLessThan(
        callOrder.indexOf("savePayment"),
      );

      // 토큰 만료는 결제 저장 후에 발생
      expect(callOrder.indexOf("savePayment")).toBeLessThan(
        callOrder.indexOf("expireToken"),
      );
    });
  });
});
