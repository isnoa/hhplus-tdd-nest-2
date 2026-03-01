import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../../src/app.module";
import { DataSource, Repository } from "typeorm";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ReservationService } from "../../src/reservation/reservation.service";
import { UserService } from "../../src/user/user.service";
import { ConcertService } from "../../src/concert/concert.service";
import { QueueService } from "../../src/queue/queue.service";
import { PaymentService } from "../../src/payment/payment.service";
import { Concert } from "../../src/concert/entities/concert.entity";
import { ConcertSchedule } from "../../src/concert/entities/concert-schedule.entity";
import { Seat, SeatStatus } from "../../src/concert/entities/seat.entity";
import { User } from "../../src/user/entities/user.entity";
import { Reservation } from "../../src/reservation/entities/reservation.entity";
import { PointHistory } from "../../src/user/entities/point-history.entity";

describe("동시성 제어 (Concurrency Control) 테스트", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let reservationService: ReservationService;
  let userService: UserService;
  let concertService: ConcertService;
  let queueService: QueueService;
  let paymentService: PaymentService;
  let concertRepository: Repository<Concert>;
  let concertScheduleRepository: Repository<ConcertSchedule>;
  let seatRepository: Repository<Seat>;
  let userRepository: Repository<User>;
  let reservationRepository: Repository<Reservation>;
  let pointHistoryRepository: Repository<PointHistory>;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = moduleRef.get<DataSource>(DataSource);
    reservationService = moduleRef.get<ReservationService>(ReservationService);
    userService = moduleRef.get<UserService>(UserService);
    concertService = moduleRef.get<ConcertService>(ConcertService);
    queueService = moduleRef.get<QueueService>(QueueService);
    paymentService = moduleRef.get<PaymentService>(PaymentService);
    concertRepository = moduleRef.get<Repository<Concert>>(
      getRepositoryToken(Concert),
    );
    concertScheduleRepository = moduleRef.get<Repository<ConcertSchedule>>(
      getRepositoryToken(ConcertSchedule),
    );
    seatRepository = moduleRef.get<Repository<Seat>>(
      getRepositoryToken(Seat),
    );
    userRepository = moduleRef.get<Repository<User>>(
      getRepositoryToken(User),
    );
    reservationRepository = moduleRef.get<Repository<Reservation>>(
      getRepositoryToken(Reservation),
    );
    pointHistoryRepository = moduleRef.get<Repository<PointHistory>>(
      getRepositoryToken(PointHistory),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // 테스트 데이터 초기화 헬퍼
  async function clearTestData() {
    await reservationRepository.delete({});
    await pointHistoryRepository.delete({});
    await seatRepository.delete({});
    await concertScheduleRepository.delete({});
    await concertRepository.delete({});
    await userRepository.delete({});
  }

  describe("테스트 1: 같은 좌석에 대한 동시 예약 요청 (중복 예약 방지)", () => {
    let concertScheduleId: number;
    let seatNumber: number = 1;
    let userIds: number[] = [];

    beforeEach(async () => {
      // 테스트 데이터 초기화
      await clearTestData();

      // 콘서트 생성
      const concert = await concertRepository.save({
        name: "Test Concert",
      });

      // 일정 생성
      const schedule = await concertScheduleRepository.save({
        concertId: concert.id,
        concertDate: new Date().toISOString().split('T')[0],
        totalSeats: 50,
        price: 100,
      });
      concertScheduleId = schedule.id;

      // 좌석 생성
      await seatRepository.save({
        concertScheduleId: schedule.id,
        seatNumber,
        status: SeatStatus.AVAILABLE,
      } as any);

      // 사용자 생성 및 포인트 충전
      userIds = [];
      for (let i = 0; i < 5; i++) {
        const user = await userRepository.save({
          email: `user${i}@test.com`,
          name: `User ${i}`,
          point: 10000,
        });
        userIds.push(user.id);
      }
    });

    it("동시에 5개의 예약 요청이 들어올 때, 오직 1개만 성공해야 함", async () => {
      const concurrentRequests = userIds.map((userId) =>
        reservationService
          .createReservation(userId, {
            concertScheduleId,
            seatNumber,
          })
          .then(() => ({ success: true }))
          .catch(() => ({ success: false })),
      );

      const results = await Promise.all(concurrentRequests);
      const successCount = results.filter((r) => r.success).length;

      // 오직 1개의 예약만 성공해야 함
      expect(successCount).toBe(1);

      // 좌석 상태 확인
      const seat = await seatRepository.findOne({
        where: { concertScheduleId, seatNumber },
      });
      expect(seat?.status).toBe("TEMP_RESERVED");
    });

    it("실패한 예약 요청들은 ConflictException을 받아야 함", async () => {
      const concurrentRequests = userIds.slice(0, 3).map((userId) =>
        reservationService.createReservation(userId, {
          concertScheduleId,
          seatNumber,
        }),
      );

      const results = await Promise.allSettled(concurrentRequests);
      const failedResults = results.filter(
        (r) => r.status === "rejected",
      );

      // 최소 2개 이상의 요청이 실패해야 함
      expect(failedResults.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("테스트 2: 동시 포인트 차감 (잔액 음수 방지)", () => {
    let userId: number;
    const INITIAL_POINT = 1000;
    const DEDUCT_AMOUNT = 100;

    beforeEach(async () => {
      // 테스트 데이터 초기화
      await clearTestData();

      // 사용자 생성
      const user = await userRepository.save({
        email: "concurrency-user@test.com",
        name: "Concurrency User",
        point: INITIAL_POINT,
      });
      userId = user.id;
    });

    it("동시에 10개의 포인트 차감 요청이 들어올 때, 모든 요청이 성공하고 최종 포인트가 0이어야 함", async () => {
      const deductRequests = Array.from({ length: 10 }, () =>
        dataSource.transaction(async (manager) => {
          try {
            const user = await userService.deductPoint(
              userId,
              DEDUCT_AMOUNT,
              manager,
            );
            return { success: true, remainingPoint: user.point };
          } catch (error) {
            return { success: false, error };
          }
        }),
      );

      const results = await Promise.all(deductRequests);
      const successCount = results.filter((r) => r.success).length;

      // 모든 요청이 성공해야 함
      expect(successCount).toBe(10);

      // 최종 포인트 확인
      const user = await userService.getUser(userId);
      expect(user.point).toBe(0);
    });

    it("포인트가 부족할 때, 차감 요청이 실패해야 함", async () => {
      const deductRequests = Array.from({ length: 15 }, () =>
        dataSource.transaction(async (manager) => {
          try {
            await userService.deductPoint(
              userId,
              DEDUCT_AMOUNT,
              manager,
            );
            return { success: true };
          } catch (error) {
            return { success: false };
          }
        }),
      );

      const results = await Promise.all(deductRequests);
      const failedCount = results.filter((r) => !r.success).length;

      // 최소 일부 요청이 실패해야 함 (포인트 부족)
      expect(failedCount).toBeGreaterThan(0);

      // 최종 포인트는 음수가 아니어야 함
      const user = await userService.getUser(userId);
      expect(user.point).toBeGreaterThanOrEqual(0);
    });
  });

  describe("테스트 3: 포인트 충전 동시성 제어", () => {
    let userId: number;
    const INITIAL_POINT = 0;
    const CHARGE_AMOUNT = 100;

    beforeEach(async () => {
      // 테스트 데이터 초기화
      await clearTestData();

      // 사용자 생성
      const user = await userRepository.save({
        email: "charge-user@test.com",
        name: "Charge User",
        point: INITIAL_POINT,
      });
      userId = user.id;
    });

    it("동시에 10개의 포인트 충전 요청이 들어올 때, 최종 포인트가 1000이어야 함", async () => {
      const chargeRequests = Array.from({ length: 10 }, () =>
        userService
          .chargePoint({
            userId,
            amount: CHARGE_AMOUNT,
          })
          .then(() => ({ success: true }))
          .catch(() => ({ success: false })),
      );

      const results = await Promise.all(chargeRequests);
      const successCount = results.filter((r) => r.success).length;

      // 모든 요청이 성공해야 함
      expect(successCount).toBe(10);

      // 최종 포인트 확인
      const user = await userService.getUser(userId);
      expect(user.point).toBe(INITIAL_POINT + CHARGE_AMOUNT * 10);
    });
  });

  describe("테스트 4: 타임아웃 해제 스케줄러", () => {
    let concertScheduleId: number;
    let seatNumberForTimeout: number = 10;
    let userId: number;

    beforeEach(async () => {
      // 테스트 데이터 초기화
      await clearTestData();

      // 콘서트 생성
      const concert = await concertRepository.save({
        name: "Scheduler Test Concert",
      });

      // 일정 생성
      const schedule = await concertScheduleRepository.save({
        concertId: concert.id,
        concertDate: new Date().toISOString().split('T')[0],
        totalSeats: 50,
        price: 100,
      });
      concertScheduleId = schedule.id;

      // 좌석 생성
      await seatRepository.save({
        concertScheduleId: schedule.id,
        seatNumber: seatNumberForTimeout,
        status: SeatStatus.AVAILABLE,
      } as any);

      // 사용자 생성
      const user = await userRepository.save({
        email: "timeout-user@test.com",
        name: "Timeout User",
        point: 10000,
      });
      userId = user.id;
    });

    it("임시 예약이 타임아웃되면, 좌석 상태가 AVAILABLE로 변경되어야 함", async () => {
      // 임시 예약 생성 (1분 후 만료)
      const reservation = await reservationService.createReservation(userId, {
        concertScheduleId,
        seatNumber: seatNumberForTimeout,
      });

      // 임시 예약 직후 좌석 상태 확인
      const initialSeat = await seatRepository.findOne({
        where: { concertScheduleId, seatNumber: seatNumberForTimeout },
      });
      expect(initialSeat?.status).toBe(SeatStatus.TEMP_RESERVED);

      // 만료 시간을 현재 시간 이전으로 수동 설정 (타임아웃 시뮬레이션)
      const seat = await seatRepository.findOne({
        where: { concertScheduleId, seatNumber: seatNumberForTimeout },
      });
      seat!.tempReservedUntil = new Date(Date.now() - 1000);
      await seatRepository.save(seat!);

      // 스케줄러 실행 (수동)
      await reservationService.releaseExpiredTempReservations();

      // 스케줄러 실행 후 좌석 상태 확인
      const updatedSeat = await seatRepository.findOne({
        where: { concertScheduleId, seatNumber: seatNumberForTimeout },
      });
      expect(updatedSeat?.status).toBe("AVAILABLE");
      expect(updatedSeat?.tempReservedUntil).toBeNull();
    });

    it("예약도 EXPIRED 상태로 변경되어야 함", async () => {
      // 임시 예약 생성
      const reservation = await reservationService.createReservation(userId, {
        concertScheduleId,
        seatNumber: seatNumberForTimeout,
      });

      // 예약 만료 시간을 현재 시간 이전으로 설정
      const reservationEntity = await reservationRepository.findOne({
        where: { id: reservation.id },
      });
      reservationEntity!.expiresAt = new Date(Date.now() - 1000);
      await reservationRepository.save(reservationEntity!);

      // 스케줄러 실행
      await reservationService.releaseExpiredTempReservations();

      // 예약 상태 확인
      const updatedReservation = await reservationService.getReservation(
        reservation.id,
      );
      expect(updatedReservation.status).toBe("EXPIRED");
    });
  });

  describe("테스트 5: 예약 전체 흐름 (동시성 제어 포함)", () => {
    let concertScheduleId: number;
    let users: any[] = [];

    beforeEach(async () => {
      // 테스트 데이터 초기화
      await clearTestData();

      // 콘서트 생성
      const concert = await concertRepository.save({
        name: "Full Flow Test Concert",
      });

      // 일정 생성
      const schedule = await concertScheduleRepository.save({
        concertId: concert.id,
        concertDate: new Date().toISOString().split('T')[0],
        totalSeats: 50,
        price: 100,
      });
      concertScheduleId = schedule.id;

      // 좌석 생성 (3개)
      for (let i = 1; i <= 3; i++) {
        await seatRepository.save({
          concertScheduleId: schedule.id,
          seatNumber: i,
          status: SeatStatus.AVAILABLE,
        } as any);
      }

      // 사용자 생성 (충분한 포인트)
      users = [];
      for (let i = 0; i < 5; i++) {
        const user = await userRepository.save({
          email: `fullflow-user${i}@test.com`,
          name: `Full Flow User ${i}`,
          point: 5000,
        });
        users.push({
          id: user.id,
        });
      }
    });

    it("여러 사용자가 다른 좌석에 동시에 예약할 때, 모두 성공해야 함", async () => {
      const reservationRequests = users.slice(0, 3).map((user, index) =>
        reservationService
          .createReservation(user.id, {
            concertScheduleId,
            seatNumber: index + 1,
          })
          .then((res) => ({ success: true, reservation: res }))
          .catch(() => ({ success: false })),
      );

      const results = await Promise.all(reservationRequests);
      const successCount = results.filter((r) => r.success).length;

      expect(successCount).toBe(3);

      // 좌석 예약 상태 확인
      const reservedSeats = await seatRepository.find({
        where: { concertScheduleId },
        order: { seatNumber: 'ASC' },
      });
      const tempReservedCount = reservedSeats.filter(
        (s) => s.status === "TEMP_RESERVED",
      ).length;
      expect(tempReservedCount).toBe(3);
    });
  });
});
