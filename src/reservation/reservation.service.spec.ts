import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { ReservationService } from "./reservation.service";
import {
  Reservation,
  ReservationStatus,
  TEMP_RESERVATION_MINUTES,
} from "./entities/reservation.entity";
import { Seat, SeatStatus } from "../concert/entities/seat.entity";
import { ConcertSchedule } from "../concert/entities/concert-schedule.entity";

/**
 * ReservationService 레이어드 아키텍처 테스트
 * 레이어드 아키텍처: 모든 외부 의존성(Repository, DataSource 등)을 Mock으로 대체
 * 각 의존성은 독립적으로 Mock 처리되어 서비스 로직만 검증
 */

// Mock Factory 함수들 - 각 Repository Mock 생성
const mockReservationRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
});

const mockSeatRepo = () => ({
  findOne: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockScheduleRepo = () => ({
  findOne: jest.fn(),
});

// Transaction Manager Mock 빌더 - 데이터베이스 트랜잭션 시뮬레이션
const buildManager = (overrides: Partial<any> = {}) => ({
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  ...overrides,
});

// DataSource Mock - 트랜잭션 격리
const mockDataSource = { transaction: jest.fn() };

describe("ReservationService - 레이어드 아키텍처 테스트", () => {
  let service: ReservationService;
  let mockReservationRepository: any;
  let mockSeatRepository: any;
  let mockScheduleRepository: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationService,
        {
          provide: getRepositoryToken(Reservation),
          useFactory: mockReservationRepo,
        },
        { provide: getRepositoryToken(Seat), useFactory: mockSeatRepo },
        {
          provide: getRepositoryToken(ConcertSchedule),
          useFactory: mockScheduleRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ReservationService>(ReservationService);
    mockReservationRepository = module.get(getRepositoryToken(Reservation));
    mockSeatRepository = module.get(getRepositoryToken(Seat));
    mockScheduleRepository = module.get(getRepositoryToken(ConcertSchedule));
  });

  afterEach(() => jest.clearAllMocks());

  describe("createReservation - 성공 시나리오", () => {
    it("정상적으로 좌석을 예약해야 한다", async () => {
      // Given: 테스트 데이터
      const userId = 1;
      const concertScheduleId = 1;
      const seatNumber = 5;

      // 예약할 콘서트 일정 데이터
      const schedule: Partial<ConcertSchedule> = {
        id: concertScheduleId,
        concertDate: "2026-03-01",
      };

      // 예약할 좌석 데이터 (사용 가능)
      const seat: Partial<Seat> = {
        id: 10,
        seatNumber,
        status: SeatStatus.AVAILABLE,
        tempReservedUntil: null,
      };

      // 생성될 예약 데이터
      const reservation = {
        id: 100,
        userId,
        seatId: 10,
        concertScheduleId,
        status: ReservationStatus.PENDING,
        expiresAt: new Date(Date.now() + TEMP_RESERVATION_MINUTES * 60 * 1000),
      } as any;

      // Mock 설정: transaction 콜백 실행
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      // Mock 설정: 일정 조회 성공
      manager.findOne.mockResolvedValueOnce(schedule);

      // Mock 설정: 좌석 조회 (pessimistic write lock 포함)
      const seatQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...seat }),
      };
      manager.createQueryBuilder.mockReturnValue(seatQb);

      // Mock 설정: 좌석 상태 업데이트
      manager.save.mockResolvedValueOnce({
        ...seat,
        status: SeatStatus.TEMP_RESERVED,
      });

      // Mock 설정: 예약 생성 및 저장
      manager.create.mockReturnValue(reservation);
      manager.save.mockResolvedValueOnce(reservation);

      // When: 예약 생성
      const result = await service.createReservation(userId, {
        concertScheduleId,
        seatNumber,
      });

      // Then: 결과 검증
      expect(result.status).toBe(ReservationStatus.PENDING);
      expect(result.userId).toBe(userId);
      expect(result.seatId).toBe(10);

      // Mock 호출 검증: 각 의존성이 올바르게 호출되었는지 확인
      expect(manager.findOne).toHaveBeenCalledWith(
        ConcertSchedule,
        expect.any(Object),
      );
      expect(manager.createQueryBuilder).toHaveBeenCalled();
      expect(seatQb.setLock).toHaveBeenCalledWith("pessimistic_write");
      expect(seatQb.where).toHaveBeenCalled();
      expect(manager.create).toHaveBeenCalled();
    });
  });

  describe("createReservation - 좌석 상태 검증 실패", () => {
    it("이미 예약된 좌석에 예약 시 ConflictException을 throw해야 한다", async () => {
      // Given: 이미 예약된 좌석
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      // Mock 설정: 일정 조회 성공
      manager.findOne.mockResolvedValueOnce({
        id: 1,
        concertDate: "2026-03-01",
      });

      // Mock 설정: 좌석이 이미 예약된 상태
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

      // When & Then: ConflictException이 발생해야 함
      await expect(
        service.createReservation(1, { concertScheduleId: 1, seatNumber: 5 }),
      ).rejects.toThrow(ConflictException);

      // Mock 호출 검증
      expect(manager.findOne).toHaveBeenCalled();
      expect(seatQb.getOne).toHaveBeenCalled();
    });

    it("존재하지 않는 좌석 상태를 반환받으면 NotFoundException을 throw해야 한다", async () => {
      // Given: 좌석을 찾을 수 없음
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      // Mock 설정: 일정 조회 성공
      manager.findOne.mockResolvedValueOnce({ id: 1 });

      // Mock 설정: 좌석을 찾을 수 없음
      const seatQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      manager.createQueryBuilder.mockReturnValue(seatQb);

      // When & Then
      await expect(
        service.createReservation(1, { concertScheduleId: 1, seatNumber: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("createReservation - 일정 검증 실패", () => {
    it("존재하지 않는 콘서트 일정에 예약 시 NotFoundException을 throw해야 한다", async () => {
      // Given: 일정이 없음
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      // Mock 설정: 일정을 찾을 수 없음
      manager.findOne.mockResolvedValueOnce(null);

      // When & Then
      await expect(
        service.createReservation(1, { concertScheduleId: 999, seatNumber: 5 }),
      ).rejects.toThrow(NotFoundException);

      // Mock 호출 검증
      expect(manager.findOne).toHaveBeenCalledWith(
        ConcertSchedule,
        expect.any(Object),
      );
    });
  });

  describe("createReservation - 비즈니스 로직 검증", () => {
    it("예약 만료 시간이 정확하게 설정되어야 한다", async () => {
      // Given
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      const schedule = { id: 1 };
      const seat = { id: 10, seatNumber: 5, status: SeatStatus.AVAILABLE };
      const now = Date.now();

      manager.findOne.mockResolvedValueOnce(schedule);

      const seatQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(seat),
      };
      manager.createQueryBuilder.mockReturnValue(seatQb);
      manager.save.mockResolvedValueOnce(seat);

      let createdReservation: any;
      manager.create.mockImplementation((entity, data) => {
        createdReservation = data;
        return data;
      });
      manager.save.mockResolvedValueOnce(createdReservation);

      // When
      await service.createReservation(1, {
        concertScheduleId: 1,
        seatNumber: 5,
      });

      // Then: 예약 만료 시간이 TEMP_RESERVATION_MINUTES 이내 범위인지 확인
      expect(createdReservation.expiresAt).toBeDefined();
      const expiresAtTime = new Date(createdReservation.expiresAt).getTime();
      const expectedMinTime = now + (TEMP_RESERVATION_MINUTES - 1) * 60 * 1000;
      const expectedMaxTime = now + (TEMP_RESERVATION_MINUTES + 1) * 60 * 1000;
      expect(expiresAtTime).toBeGreaterThanOrEqual(expectedMinTime);
      expect(expiresAtTime).toBeLessThanOrEqual(expectedMaxTime);
    });

    it("좌석 상태가 TEMP_RESERVED로 업데이트되어야 한다", async () => {
      // Given
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      const schedule = { id: 1 };
      const seat = { id: 10, seatNumber: 5, status: SeatStatus.AVAILABLE };

      manager.findOne.mockResolvedValueOnce(schedule);

      const seatQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(seat),
      };
      manager.createQueryBuilder.mockReturnValue(seatQb);

      const updatedSeat = { ...seat, status: SeatStatus.TEMP_RESERVED };
      manager.save.mockResolvedValueOnce(updatedSeat);

      const reservation = {
        id: 100,
        userId: 1,
        seatId: 10,
        status: ReservationStatus.PENDING,
      };
      manager.create.mockReturnValue(reservation);
      manager.save.mockResolvedValueOnce(reservation);

      // When
      await service.createReservation(1, {
        concertScheduleId: 1,
        seatNumber: 5,
      });

      // Then: save가 호출되어 좌석이 업데이트되었는지 확인
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: SeatStatus.TEMP_RESERVED,
        }),
      );
    });

    it("트랜잭션 내에서 모든 작업이 실행되어야 한다", async () => {
      // Given: transaction wrapper가 호출되었는지 확인
      const manager = buildManager();
      let transactionCalled = false;
      mockDataSource.transaction.mockImplementation((cb) => {
        transactionCalled = true;
        return cb(manager);
      });

      manager.findOne.mockResolvedValueOnce({ id: 1 });
      const seatQb = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValue({ id: 10, status: SeatStatus.AVAILABLE }),
      };
      manager.createQueryBuilder.mockReturnValue(seatQb);
      manager.save.mockResolvedValue({
        id: 10,
        status: SeatStatus.TEMP_RESERVED,
      });
      manager.create.mockReturnValue({
        id: 100,
        status: ReservationStatus.PENDING,
      });
      manager.save.mockResolvedValueOnce({
        id: 100,
        status: ReservationStatus.PENDING,
      });

      // When
      await service.createReservation(1, {
        concertScheduleId: 1,
        seatNumber: 5,
      });

      // Then: transaction이 호출되었는지 확인
      expect(transactionCalled).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });

  describe("releaseExpiredTempReservations - 타임아웃 임시 예약 해제 스케줄러", () => {
    it("타임아웃된 임시 예약 좌석을 AVAILABLE로 변경해야 한다", async () => {
      // Given: 타임아웃된 임시 예약 좌석들
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      const expiredSeats = [
        {
          id: 1,
          status: SeatStatus.TEMP_RESERVED,
          tempReservedUntil: new Date(Date.now() - 1000),
          tempReservedUserId: 1,
        },
        {
          id: 2,
          status: SeatStatus.TEMP_RESERVED,
          tempReservedUntil: new Date(Date.now() - 1000),
          tempReservedUserId: 2,
        },
      ];

      // Mock 설정: 만료된 좌석 조회
      const seatQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expiredSeats),
      };
      manager.createQueryBuilder.mockReturnValueOnce(seatQb);

      // Mock 설정: 좌석 저장 (상태 업데이트)
      manager.save.mockResolvedValue(null);

      // Mock 설정: 예약 상태 업데이트 (EXPIRED)
      const reservationQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(null),
      };
      manager.createQueryBuilder.mockReturnValueOnce(reservationQb);

      // When
      await service.releaseExpiredTempReservations();

      // Then: 각 좌석이 저장되었는지 확인 (상태가 AVAILABLE로 변경됨)
      expect(manager.save).toHaveBeenCalledTimes(expiredSeats.length);
      expiredSeats.forEach((seat) => {
        expect(manager.save).toHaveBeenCalledWith(
          expect.objectContaining({
            status: SeatStatus.AVAILABLE,
            tempReservedUntil: null,
            tempReservedUserId: null,
          }),
        );
      });
    });

    it("예약 상태를 EXPIRED로 변경해야 한다", async () => {
      // Given: 타임아웃된 예약들
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      const expiredSeats: any[] = [];

      // Mock 설정: 만료된 좌석 조회 (없음)
      const seatQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expiredSeats),
      };
      manager.createQueryBuilder.mockReturnValueOnce(seatQb);

      // Mock 설정: 예약 상태 업데이트
      const reservationQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      manager.createQueryBuilder.mockReturnValueOnce(reservationQb);

      // When
      await service.releaseExpiredTempReservations();

      // Then: 예약 업데이트가 실행되었는지 확인
      expect(reservationQb.update).toHaveBeenCalledWith(Reservation);
      expect(reservationQb.set).toHaveBeenCalledWith({
        status: ReservationStatus.EXPIRED,
      });
      expect(reservationQb.execute).toHaveBeenCalled();
    });

    it("타임아웃되지 않은 좌석은 건드리지 않아야 한다", async () => {
      // Given: 아직 유효한 임시 예약 좌석
      const manager = buildManager();
      mockDataSource.transaction.mockImplementation((cb) => cb(manager));

      // 임시 예약이 아직 유효한 좌석 (10분 후 만료)
      const validSeats: any[] = [];

      // Mock 설정: 만료된 좌석이 없음
      const seatQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(validSeats),
      };
      manager.createQueryBuilder.mockReturnValueOnce(seatQb);

      // Mock 설정: 예약 업데이트 (영향받은 행 0)
      const reservationQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      manager.createQueryBuilder.mockReturnValueOnce(reservationQb);

      // When
      await service.releaseExpiredTempReservations();

      // Then: update는 실행되지만 아무 행도 영향받지 않음
      expect(reservationQb.execute).toHaveBeenCalled();
    });

    it("트랜잭션 내에서 실행되어야 한다", async () => {
      // Given: transaction wrapper
      const manager = buildManager();
      let transactionCalled = false;
      mockDataSource.transaction.mockImplementation((cb) => {
        transactionCalled = true;
        return cb(manager);
      });

      const seatQb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      manager.createQueryBuilder.mockReturnValueOnce(seatQb);

      const reservationQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(null),
      };
      manager.createQueryBuilder.mockReturnValueOnce(reservationQb);

      // When
      await service.releaseExpiredTempReservations();

      // Then
      expect(transactionCalled).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalled();
    });
  });
});
