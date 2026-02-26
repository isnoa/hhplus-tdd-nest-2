import { ProcessPaymentUseCase } from "./process-payment.use-case";
import { ProcessPaymentInputDto } from "../dto/process-payment.input.dto";
import { IPaymentRepository } from "../../domain/repositories/payment.repository";
import { IUserRepositoryPort } from "../ports/user-repository.port";
import {
  IReservationRepositoryPort,
  ReservationData,
} from "../ports/reservation-repository.port";
import {
  IConcertScheduleRepositoryPort,
  ConcertScheduleData,
} from "../ports/concert-schedule-repository.port";
import { IPaymentGatewayPort } from "../ports/payment-gateway.port";
import {
  IEventPublisherPort,
  PaymentEvent,
} from "../ports/event-publisher.port";
import { IQueueServicePort } from "../ports/queue-service.port";
import { PaymentEntity } from "../../domain/entities/payment.entity";
import { Money } from "../../domain/value-objects/money.value-object";
import { PaymentStatus } from "../../domain/value-objects/payment-status.value-object";

describe("ProcessPaymentUseCase - 클린 아키텍처 기반 테스트", () => {
  let useCase: ProcessPaymentUseCase;

  // Mock repositories
  let mockPaymentRepository: jest.Mocked<IPaymentRepository>;
  let mockUserRepository: jest.Mocked<IUserRepositoryPort>;
  let mockReservationRepository: jest.Mocked<IReservationRepositoryPort>;
  let mockConcertScheduleRepository: jest.Mocked<IConcertScheduleRepositoryPort>;
  let mockPaymentGateway: jest.Mocked<IPaymentGatewayPort>;
  let mockEventPublisher: jest.Mocked<IEventPublisherPort>;
  let mockQueueService: jest.Mocked<IQueueServicePort>;

  beforeEach(() => {
    // Mock 객체 생성
    mockPaymentRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByReservationId: jest.fn(),
      findByUserId: jest.fn(),
    };

    mockUserRepository = {
      getUserPoint: jest.fn(),
      deductPoint: jest.fn(),
      addPoint: jest.fn(),
    };

    mockReservationRepository = {
      getReservation: jest.fn(),
      confirmReservation: jest.fn(),
      cancelReservation: jest.fn(),
    };

    mockConcertScheduleRepository = {
      getSchedule: jest.fn(),
    };

    mockPaymentGateway = {
      processPayment: jest.fn(),
      refundPayment: jest.fn(),
    };

    mockEventPublisher = {
      publishPaymentEvent: jest.fn(),
    };

    mockQueueService = {
      checkQueueToken: jest.fn(),
      expireToken: jest.fn(),
    };

    // UseCase 인스턴스 생성 (모든 의존성을 Mock으로 주입)
    useCase = new ProcessPaymentUseCase(
      mockPaymentRepository,
      mockUserRepository,
      mockReservationRepository,
      mockConcertScheduleRepository,
      mockPaymentGateway,
      mockEventPublisher,
      mockQueueService,
    );
  });

  describe("ProcessPaymentUseCase.execute() - 성공 시나리오", () => {
    it("정상적으로 결제를 처리해야 한다", async () => {
      // Given: 테스트 데이터
      const userId = 1;
      const reservationId = 100;
      const queueToken = "test-queue-token";
      const concertScheduleId = 5;
      const price = 50000;

      const input = new ProcessPaymentInputDto(
        userId,
        reservationId,
        queueToken,
      );

      // Mock 설정: 모든 외부 의존성의 성공 케이스
      const reservationData: ReservationData = {
        id: reservationId,
        userId,
        seatId: 10,
        concertScheduleId,
        status: "TEMP",
        createdAt: new Date(),
      };

      const scheduleData: ConcertScheduleData = {
        id: concertScheduleId,
        price,
        totalSeats: 100,
        availableSeats: 50,
      };

      mockReservationRepository.getReservation.mockResolvedValue(
        reservationData,
      );
      mockConcertScheduleRepository.getSchedule.mockResolvedValue(scheduleData);
      mockUserRepository.getUserPoint.mockResolvedValue(100000); // 충분한 포인트
      mockUserRepository.deductPoint.mockResolvedValue(true);
      mockPaymentGateway.processPayment.mockResolvedValue({
        success: true,
        transactionId: "TXN_123",
      });
      mockReservationRepository.confirmReservation.mockResolvedValue({
        ...reservationData,
        status: "CONFIRMED",
      });

      const savedPayment = PaymentEntity.reconstruct(
        1,
        userId,
        reservationId,
        Money.create(price),
        PaymentStatus.completed(),
        new Date(),
        new Date(),
      );
      mockPaymentRepository.save.mockResolvedValue(savedPayment);
      mockEventPublisher.publishPaymentEvent.mockResolvedValue();
      mockQueueService.expireToken.mockResolvedValue(true);

      // When: UseCase 실행
      const result = await useCase.execute(input);

      // Then: 결과 검증
      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.reservationId).toBe(reservationId);
      expect(result.amount).toBe(price);
      expect(result.status).toBe("COMPLETED");

      // Mock 호출 검증: 모든 외부 의존성이 올바른 순서와 파라미터로 호출되었는지 확인
      expect(mockReservationRepository.getReservation).toHaveBeenCalledWith(
        reservationId,
      );
      expect(mockConcertScheduleRepository.getSchedule).toHaveBeenCalledWith(
        concertScheduleId,
      );
      expect(mockUserRepository.getUserPoint).toHaveBeenCalledWith(userId);
      expect(mockPaymentGateway.processPayment).toHaveBeenCalledWith(
        userId,
        price,
      );
      expect(mockReservationRepository.confirmReservation).toHaveBeenCalledWith(
        reservationId,
        userId,
      );
      expect(mockUserRepository.deductPoint).toHaveBeenCalledWith(
        userId,
        price,
      );
      expect(mockPaymentRepository.save).toHaveBeenCalled();
      expect(mockEventPublisher.publishPaymentEvent).toHaveBeenCalled();
      expect(mockQueueService.expireToken).toHaveBeenCalledWith(queueToken);
    });
  });

  describe("ProcessPaymentUseCase.execute() - 예약 검증 실패", () => {
    it("예약을 찾을 수 없으면 에러를 throw해야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 999;
      const input = new ProcessPaymentInputDto(userId, reservationId);

      mockReservationRepository.getReservation.mockResolvedValue(null);

      // When & Then
      await expect(useCase.execute(input)).rejects.toThrow(
        "예약을 찾을 수 없습니다.",
      );
    });

    it("예약한 사용자가 아니면 에러를 throw해야 한다", async () => {
      // Given
      const userId = 1;
      const otherUserId = 2;
      const reservationId = 100;
      const input = new ProcessPaymentInputDto(userId, reservationId);

      const reservationData: ReservationData = {
        id: reservationId,
        userId: otherUserId,
        seatId: 10,
        concertScheduleId: 5,
        status: "TEMP",
        createdAt: new Date(),
      };

      mockReservationRepository.getReservation.mockResolvedValue(
        reservationData,
      );

      // When & Then
      await expect(useCase.execute(input)).rejects.toThrow(
        "예약한 사용자만 결제할 수 있습니다.",
      );
    });
  });

  describe("ProcessPaymentUseCase.execute() - 콘서트 일정 검증 실패", () => {
    it("콘서트 일정을 찾을 수 없으면 에러를 throw해야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 100;
      const concertScheduleId = 999;
      const input = new ProcessPaymentInputDto(userId, reservationId);

      const reservationData: ReservationData = {
        id: reservationId,
        userId,
        seatId: 10,
        concertScheduleId,
        status: "TEMP",
        createdAt: new Date(),
      };

      mockReservationRepository.getReservation.mockResolvedValue(
        reservationData,
      );
      mockConcertScheduleRepository.getSchedule.mockResolvedValue(null);

      // When & Then
      await expect(useCase.execute(input)).rejects.toThrow(
        "콘서트 일정을 찾을 수 없습니다.",
      );
    });
  });

  describe("ProcessPaymentUseCase.execute() - 포인트 검증 실패", () => {
    it("사용자의 포인트가 부족하면 에러를 throw해야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 100;
      const concertScheduleId = 5;
      const price = 50000;
      const input = new ProcessPaymentInputDto(userId, reservationId);

      const reservationData: ReservationData = {
        id: reservationId,
        userId,
        seatId: 10,
        concertScheduleId,
        status: "TEMP",
        createdAt: new Date(),
      };

      const scheduleData: ConcertScheduleData = {
        id: concertScheduleId,
        price,
        totalSeats: 100,
        availableSeats: 50,
      };

      mockReservationRepository.getReservation.mockResolvedValue(
        reservationData,
      );
      mockConcertScheduleRepository.getSchedule.mockResolvedValue(scheduleData);
      mockUserRepository.getUserPoint.mockResolvedValue(10000); // 포인트 부족

      // When & Then
      await expect(useCase.execute(input)).rejects.toThrow(
        "사용자의 포인트가 부족합니다.",
      );
    });
  });

  describe("ProcessPaymentUseCase.execute() - 결제 게이트웨이 실패", () => {
    it("결제 게이트웨이에서 실패하면 에러를 throw해야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 100;
      const concertScheduleId = 5;
      const price = 50000;
      const input = new ProcessPaymentInputDto(userId, reservationId);

      const reservationData: ReservationData = {
        id: reservationId,
        userId,
        seatId: 10,
        concertScheduleId,
        status: "TEMP",
        createdAt: new Date(),
      };

      const scheduleData: ConcertScheduleData = {
        id: concertScheduleId,
        price,
        totalSeats: 100,
        availableSeats: 50,
      };

      mockReservationRepository.getReservation.mockResolvedValue(
        reservationData,
      );
      mockConcertScheduleRepository.getSchedule.mockResolvedValue(scheduleData);
      mockUserRepository.getUserPoint.mockResolvedValue(100000);
      mockPaymentGateway.processPayment.mockResolvedValue({
        success: false,
        errorMessage: "카드 승인 거부",
      });

      // When & Then
      await expect(useCase.execute(input)).rejects.toThrow(
        "결제 처리 실패: 카드 승인 거부",
      );
    });
  });

  describe("ProcessPaymentUseCase.execute() - 비즈니스 로직 검증", () => {
    it("결제 금액이 정확하게 차감되어야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 100;
      const queueToken = "test-queue-token";
      const concertScheduleId = 5;
      const price = 30000;

      const input = new ProcessPaymentInputDto(
        userId,
        reservationId,
        queueToken,
      );

      const reservationData: ReservationData = {
        id: reservationId,
        userId,
        seatId: 10,
        concertScheduleId,
        status: "TEMP",
        createdAt: new Date(),
      };

      const scheduleData: ConcertScheduleData = {
        id: concertScheduleId,
        price,
        totalSeats: 100,
        availableSeats: 50,
      };

      mockReservationRepository.getReservation.mockResolvedValue(
        reservationData,
      );
      mockConcertScheduleRepository.getSchedule.mockResolvedValue(scheduleData);
      mockUserRepository.getUserPoint.mockResolvedValue(100000);
      mockUserRepository.deductPoint.mockResolvedValue(true);
      mockPaymentGateway.processPayment.mockResolvedValue({
        success: true,
        transactionId: "TXN_123",
      });
      mockReservationRepository.confirmReservation.mockResolvedValue({
        ...reservationData,
        status: "CONFIRMED",
      });

      const savedPayment = PaymentEntity.reconstruct(
        1,
        userId,
        reservationId,
        Money.create(price),
        PaymentStatus.completed(),
        new Date(),
        new Date(),
      );
      mockPaymentRepository.save.mockResolvedValue(savedPayment);
      mockEventPublisher.publishPaymentEvent.mockResolvedValue();
      mockQueueService.expireToken.mockResolvedValue(true);

      // When
      await useCase.execute(input);

      // Then: 정확한 금액이 차감되었는지 검증
      expect(mockUserRepository.deductPoint).toHaveBeenCalledWith(
        userId,
        price,
      );
      expect(mockUserRepository.deductPoint).toHaveBeenCalledTimes(1);
    });

    it("이벤트가 올바른 정보와 함께 발행되어야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 100;
      const concertScheduleId = 5;
      const price = 40000;
      const paymentId = 50;

      const input = new ProcessPaymentInputDto(userId, reservationId);

      const reservationData: ReservationData = {
        id: reservationId,
        userId,
        seatId: 10,
        concertScheduleId,
        status: "TEMP",
        createdAt: new Date(),
      };

      const scheduleData: ConcertScheduleData = {
        id: concertScheduleId,
        price,
        totalSeats: 100,
        availableSeats: 50,
      };

      mockReservationRepository.getReservation.mockResolvedValue(
        reservationData,
      );
      mockConcertScheduleRepository.getSchedule.mockResolvedValue(scheduleData);
      mockUserRepository.getUserPoint.mockResolvedValue(100000);
      mockUserRepository.deductPoint.mockResolvedValue(true);
      mockPaymentGateway.processPayment.mockResolvedValue({
        success: true,
        transactionId: "TXN_123",
      });
      mockReservationRepository.confirmReservation.mockResolvedValue({
        ...reservationData,
        status: "CONFIRMED",
      });

      const savedPayment = PaymentEntity.reconstruct(
        paymentId,
        userId,
        reservationId,
        Money.create(price),
        PaymentStatus.completed(),
        new Date(),
        new Date(),
      );
      mockPaymentRepository.save.mockResolvedValue(savedPayment);
      mockEventPublisher.publishPaymentEvent.mockResolvedValue();
      mockQueueService.expireToken.mockResolvedValue(true);

      // When
      await useCase.execute(input);

      // Then: 이벤트가 올바른 정보와 함께 발행되었는지 검증
      expect(mockEventPublisher.publishPaymentEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "PAYMENT_COMPLETED",
          paymentId,
          userId,
          reservationId,
          amount: price,
        }),
      );
    });
  });

  describe("ProcessPaymentUseCase.execute() - 순서 검증", () => {
    it("각 단계가 올바른 순서로 실행되어야 한다", async () => {
      // Given
      const userId = 1;
      const reservationId = 100;
      const concertScheduleId = 5;
      const price = 50000;
      const callOrder: string[] = [];

      const input = new ProcessPaymentInputDto(userId, reservationId);

      const reservationData: ReservationData = {
        id: reservationId,
        userId,
        seatId: 10,
        concertScheduleId,
        status: "TEMP",
        createdAt: new Date(),
      };

      const scheduleData: ConcertScheduleData = {
        id: concertScheduleId,
        price,
        totalSeats: 100,
        availableSeats: 50,
      };

      // Mock 함수에 호출 순서 추적 로직 추가
      mockReservationRepository.getReservation.mockImplementation(async () => {
        callOrder.push("getReservation");
        return reservationData;
      });
      mockConcertScheduleRepository.getSchedule.mockImplementation(async () => {
        callOrder.push("getSchedule");
        return scheduleData;
      });
      mockUserRepository.getUserPoint.mockImplementation(async () => {
        callOrder.push("getUserPoint");
        return 100000;
      });
      mockPaymentGateway.processPayment.mockImplementation(async () => {
        callOrder.push("processPayment");
        return { success: true, transactionId: "TXN_123" };
      });
      mockReservationRepository.confirmReservation.mockImplementation(
        async () => {
          callOrder.push("confirmReservation");
          return { ...reservationData, status: "CONFIRMED" };
        },
      );
      mockUserRepository.deductPoint.mockImplementation(async () => {
        callOrder.push("deductPoint");
        return true;
      });

      const savedPayment = PaymentEntity.reconstruct(
        1,
        userId,
        reservationId,
        Money.create(price),
        PaymentStatus.completed(),
        new Date(),
        new Date(),
      );
      mockPaymentRepository.save.mockImplementation(async () => {
        callOrder.push("save");
        return savedPayment;
      });
      mockEventPublisher.publishPaymentEvent.mockImplementation(async () => {
        callOrder.push("publishEvent");
      });

      // When
      await useCase.execute(input);

      // Then: 실행 순서 검증
      expect(callOrder).toEqual([
        "getReservation",
        "getSchedule",
        "getUserPoint",
        "processPayment",
        "confirmReservation",
        "deductPoint",
        "save",
        "publishEvent",
      ]);
    });
  });
});
