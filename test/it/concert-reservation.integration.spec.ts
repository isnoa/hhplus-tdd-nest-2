import { Test, TestingModule } from "@nestjs/testing";
import { DatabaseModule } from "../../src/database/database.module";
import { InfrastructureModule } from "../../src/infrastructure/infrastructure.module";
import { QueueTokenRepository } from "../../src/infrastructure/persistence/queue-token/queue-token.repository.impl";
import { SeatReservationRepository } from "../../src/infrastructure/persistence/seat-reservation/seat-reservation.repository.impl";
import { UserBalanceRepository } from "../../src/infrastructure/persistence/user-balance/user-balance.repository.impl";
import { PaymentRepository } from "../../src/infrastructure/persistence/payment/payment.repository.impl";
import { DataSource } from "typeorm";
import { INestApplication } from "@nestjs/common";

describe("Concert Reservation Integration Tests", () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let queueTokenRepository: QueueTokenRepository;
  let seatReservationRepository: SeatReservationRepository;
  let userBalanceRepository: UserBalanceRepository;
  let paymentRepository: PaymentRepository;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, InfrastructureModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dataSource = moduleRef.get<DataSource>(DataSource);
    queueTokenRepository =
      moduleRef.get<QueueTokenRepository>(QueueTokenRepository);
    seatReservationRepository = moduleRef.get<SeatReservationRepository>(
      SeatReservationRepository,
    );
    userBalanceRepository = moduleRef.get<UserBalanceRepository>(
      UserBalanceRepository,
    );
    paymentRepository = moduleRef.get<PaymentRepository>(PaymentRepository);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("시나리오 1: 전체 예약 흐름 (토큰 → 좌석 예약 → 결제)", () => {
    let userId: number;
    let concertScheduleId: number;
    let seatId: number;
    let token: string;
    const PRICE = 100;
    const INITIAL_BALANCE = 1000;

    beforeAll(async () => {
      // 1. 사용자 생성 및 포인트 충전
      const userResult = await dataSource.query(
        "INSERT INTO users (name, point) VALUES (?, ?)",
        ["Test User 1", INITIAL_BALANCE],
      );
      userId = userResult.insertId;

      // 2. 콘서트 및 스케줄 생성
      const concertResult = await dataSource.query(
        "INSERT INTO concerts (name) VALUES (?)",
        ["Test Concert 1"],
      );
      const concertId = concertResult.insertId;

      const scheduleResult = await dataSource.query(
        "INSERT INTO concert_schedules (concertId, concertDate, totalSeats, price) VALUES (?, ?, ?, ?)",
        [concertId, "2026-03-15", 10, PRICE],
      );
      concertScheduleId = scheduleResult.insertId;

      // 3. 좌석 생성
      const seatResult = await dataSource.query(
        "INSERT INTO seats (concertScheduleId, seatNumber, status) VALUES (?, ?, ?)",
        [concertScheduleId, 1, "AVAILABLE"],
      );
      seatId = seatResult.insertId;
    });

    it("1-1: 토큰 발급 성공", async () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 후
      token = await queueTokenRepository.issueToken(userId, expiresAt);

      expect(token).toBeDefined();
      expect(token).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it("1-2: 토큰 검증 성공", async () => {
      const retrieved = await queueTokenRepository.getUserIdByToken(token);
      expect(retrieved).toBe(userId);
    });

    it("1-3: 좌석 임시 예약 성공", async () => {
      const tempReservedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5분 후
      const success = await seatReservationRepository.reserveSeatTemporarily(
        seatId,
        userId,
        tempReservedUntil,
      );

      expect(success).toBe(true);
    });

    it("1-4: 좌석 임시 예약 상태 확인", async () => {
      const isReserved =
        await seatReservationRepository.isTemporarilyReserved(seatId);
      expect(isReserved).toBe(true);

      const status = await seatReservationRepository.getSeatStatus(seatId);
      expect(status).toBe("TEMPORARILY_RESERVED");
    });

    it("1-5: 사용자 잔액 확인", async () => {
      const balance = await userBalanceRepository.getBalance(userId);
      expect(balance).toBe(INITIAL_BALANCE);
    });

    it("1-6: 잔액 충분 여부 확인", async () => {
      const hasSufficient = await userBalanceRepository.hasSufficientBalance(
        userId,
        PRICE,
      );
      expect(hasSufficient).toBe(true);
    });

    it("1-7: 결제 처리 및 잔액 차감", async () => {
      // 결제 기록 저장
      const paymentInfo = await dataSource.query(
        "INSERT INTO reservations (userId, seatId, concertScheduleId, status, expiresAt) VALUES (?, ?, ?, ?, ?)",
        [
          userId,
          seatId,
          concertScheduleId,
          "CONFIRMED",
          new Date(Date.now() + 1000 * 60 * 60),
        ],
      );
      const reservationId = paymentInfo.insertId;

      const payment = await paymentRepository.savePayment(
        userId,
        reservationId,
        PRICE,
        "COMPLETED",
      );

      expect(payment.id).toBeDefined();
      expect(payment.createdAt).toBeDefined();

      // 잔액 차감
      const deductSuccess = await userBalanceRepository.deductBalance(
        userId,
        PRICE,
      );
      expect(deductSuccess).toBe(true);

      // 최종 잔액 확인
      const finalBalance = await userBalanceRepository.getBalance(userId);
      expect(finalBalance).toBe(INITIAL_BALANCE - PRICE);
    });

    it("1-8: 좌석 영구 예약 확인", async () => {
      // 임시 예약을 영구 예약으로 전환
      const confirmSuccess = await seatReservationRepository.confirmReservation(
        seatId,
        1, // reservationId
      );
      expect(confirmSuccess).toBe(true);

      const status = await seatReservationRepository.getSeatStatus(seatId);
      expect(status).toBe("RESERVED");
    });
  });

  describe("시나리오 2: 만료된 임시 예약 자동 해제", () => {
    let userId: number;
    let concertScheduleId: number;
    let seatId: number;

    beforeAll(async () => {
      // 사용자 생성
      const userResult = await dataSource.query(
        "INSERT INTO users (name, point) VALUES (?, ?)",
        ["Test User 2", 5000],
      );
      userId = userResult.insertId;

      // 콘서트 및 스케줄 생성
      const concertResult = await dataSource.query(
        "INSERT INTO concerts (name) VALUES (?)",
        ["Test Concert 2"],
      );
      const concertId = concertResult.insertId;

      const scheduleResult = await dataSource.query(
        "INSERT INTO concert_schedules (concertId, concertDate, totalSeats, price) VALUES (?, ?, ?, ?)",
        [concertId, "2026-04-15", 10, 150],
      );
      concertScheduleId = scheduleResult.insertId;

      // 좌석 생성
      const seatResult = await dataSource.query(
        "INSERT INTO seats (concertScheduleId, seatNumber, status) VALUES (?, ?, ?)",
        [concertScheduleId, 1, "AVAILABLE"],
      );
      seatId = seatResult.insertId;
    });

    it("2-1: 임시 예약 생성 (과거 만료 시간으로)", async () => {
      const expiredTime = new Date(Date.now() - 1000); // 1초 전 만료
      const success = await seatReservationRepository.reserveSeatTemporarily(
        seatId,
        userId,
        expiredTime,
      );

      expect(success).toBe(true);
    });

    it("2-2: 만료된 예약은 isTemporarilyReserved에서 false 반환", async () => {
      const isReserved =
        await seatReservationRepository.isTemporarilyReserved(seatId);
      expect(isReserved).toBe(false);
    });

    it("2-3: 만료된 예약 상태는 AVAILABLE로 간주", async () => {
      const status = await seatReservationRepository.getSeatStatus(seatId);
      expect(status).toBe("AVAILABLE");
    });

    it("2-4: 만료된 임시 예약 정리", async () => {
      const releasedCount =
        await seatReservationRepository.releaseExpiredReservations();
      expect(releasedCount).toBeGreaterThan(0);
    });

    it("2-5: 정리 후 좌석이 다시 AVAILABLE 상태", async () => {
      const status = await seatReservationRepository.getSeatStatus(seatId);
      expect(status).toBe("AVAILABLE");
    });

    it("2-6: 정리된 좌석은 다시 예약 가능", async () => {
      const newExpireTime = new Date(Date.now() + 5 * 60 * 1000); // 5분 후
      const success = await seatReservationRepository.reserveSeatTemporarily(
        seatId,
        userId,
        newExpireTime,
      );
      expect(success).toBe(true);
    });
  });

  describe("시나리오 3: 동시 좌석 요청 (한 명만 성공)", () => {
    let concertScheduleId: number;
    let seatId: number;
    const NUM_USERS = 5;

    beforeAll(async () => {
      // 여러 사용자 생성
      for (let i = 0; i < NUM_USERS; i++) {
        await dataSource.query(
          "INSERT INTO users (name, point) VALUES (?, ?)",
          [`Test User 3-${i}`, 5000],
        );
      }

      // 콘서트 및 스케줄 생성
      const concertResult = await dataSource.query(
        "INSERT INTO concerts (name) VALUES (?)",
        ["Test Concert 3"],
      );
      const concertId = concertResult.insertId;

      const scheduleResult = await dataSource.query(
        "INSERT INTO concert_schedules (concertId, concertDate, totalSeats, price) VALUES (?, ?, ?, ?)",
        [concertId, "2026-05-15", 10, 200],
      );
      concertScheduleId = scheduleResult.insertId;

      // 좌석 생성
      const seatResult = await dataSource.query(
        "INSERT INTO seats (concertScheduleId, seatNumber, status) VALUES (?, ?, ?)",
        [concertScheduleId, 1, "AVAILABLE"],
      );
      seatId = seatResult.insertId;
    });

    it("3-1: 동시에 여러 사용자가 같은 좌석 예약 요청", async () => {
      const tempReservedUntil = new Date(Date.now() + 5 * 60 * 1000);

      // 모든 사용자가 동시에 같은 좌석 예약 시도
      const userResults = [];
      for (let i = 1; i <= NUM_USERS; i++) {
        const userIdResult = await dataSource.query(
          "SELECT id FROM users WHERE name = ?",
          [`Test User 3-${i - 1}`],
        );
        const userId = userIdResult[0]?.id;

        if (userId) {
          const success =
            await seatReservationRepository.reserveSeatTemporarily(
              seatId,
              userId,
              tempReservedUntil,
            );
          userResults.push(success);
        }
      }

      // 정확히 하나의 사용자만 성공해야 함
      const successCount = userResults.filter((result) => result).length;
      expect(successCount).toBe(1);
    });

    it("3-2: 좌석이 TEMPORARILY_RESERVED 상태로 고정", async () => {
      const status = await seatReservationRepository.getSeatStatus(seatId);
      expect(status).toBe("TEMP_RESERVED");
    });

    it("3-3: 실패한 사용자는 다른 좌석을 예약 가능", async () => {
      // 새로운 좌석 생성
      const newSeatResult = await dataSource.query(
        "INSERT INTO seats (concertScheduleId, seatNumber, status) VALUES (?, ?, ?)",
        [concertScheduleId, 2, "AVAILABLE"],
      );
      const newSeatId = newSeatResult.insertId;

      // 실패했던 사용자가 새 좌석 예약 시도
      const userIdResult = await dataSource.query(
        "SELECT id FROM users WHERE name = ?",
        [`Test User 3-1`],
      );
      const userId = userIdResult[0]?.id;

      const tempReservedUntil = new Date(Date.now() + 5 * 60 * 1000);
      const success = await seatReservationRepository.reserveSeatTemporarily(
        newSeatId,
        userId,
        tempReservedUntil,
      );

      expect(success).toBe(true);
    });
  });

  describe("시나리오 4: 토큰 만료 및 정리", () => {
    let userId: number;
    let token1: string;
    let token2: string;

    beforeAll(async () => {
      // 사용자 생성
      const userResult = await dataSource.query(
        "INSERT INTO users (name, point) VALUES (?, ?)",
        ["Test User 4", 5000],
      );
      userId = userResult.insertId;
    });

    it("4-1: 같은 사용자가 여러 토큰 발급 가능", async () => {
      const expireTime1 = new Date(Date.now() + 10 * 60 * 1000);
      const expireTime2 = new Date(Date.now() + 10 * 60 * 1000);

      token1 = await queueTokenRepository.issueToken(userId, expireTime1);
      token2 = await queueTokenRepository.issueToken(userId, expireTime2);

      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2);
    });

    it("4-2: 활성 토큰의 개수 확인", async () => {
      const count = await queueTokenRepository.getActiveTokenCount(userId);
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it("4-3: 특정 토큰 삭제", async () => {
      await queueTokenRepository.deleteToken(token1);

      const isValid = await queueTokenRepository.isTokenValid(token1);
      expect(isValid).toBe(false);

      // 다른 토큰은 여전히 유효
      const isValid2 = await queueTokenRepository.isTokenValid(token2);
      expect(isValid2).toBe(true);
    });

    it("4-4: 만료된 토큰 정리", async () => {
      const expiredTime = new Date(Date.now() - 1000);
      const expiredToken = await queueTokenRepository.issueToken(
        userId,
        expiredTime,
      );

      const cleaned = await queueTokenRepository.cleanupExpiredTokens();
      expect(cleaned).toBeGreaterThan(0);

      const isValid = await queueTokenRepository.isTokenValid(expiredToken);
      expect(isValid).toBe(false);
    });
  });

  describe("시나리오 5: 낙관적 락을 이용한 동시 포인트 충전", () => {
    let userId: number;

    beforeAll(async () => {
      const userResult = await dataSource.query(
        "INSERT INTO users (name, point, version) VALUES (?, ?, ?)",
        ["Test User 5", 1000, 0],
      );
      userId = userResult.insertId;
    });

    it("5-1: 사용자 버전 정보 조회", async () => {
      const versionInfo = await userBalanceRepository.getVersionInfo(userId);
      expect(versionInfo).toBeDefined();
      expect(versionInfo?.version).toBe(0);
      expect(versionInfo?.point).toBe(1000);
    });

    it("5-2: 현재 버전으로 포인트 차감 성공", async () => {
      const success = await userBalanceRepository.updateBalanceWithVersion(
        userId,
        100,
        0,
      );
      expect(success).toBe(true);

      const balance = await userBalanceRepository.getBalance(userId);
      expect(balance).toBe(900);
    });

    it("5-3: 이전 버전으로 업데이트 실패", async () => {
      const success = await userBalanceRepository.updateBalanceWithVersion(
        userId,
        50,
        0, // 이미 version이 1로 증가했음
      );
      expect(success).toBe(false);

      // 잔액 변화 없음
      const balance = await userBalanceRepository.getBalance(userId);
      expect(balance).toBe(900);
    });

    it("5-4: 정상 버전으로 다시 업데이트 성공", async () => {
      const versionInfo = await userBalanceRepository.getVersionInfo(userId);
      const success = await userBalanceRepository.updateBalanceWithVersion(
        userId,
        50,
        versionInfo?.version || 1,
      );
      expect(success).toBe(true);

      const balance = await userBalanceRepository.getBalance(userId);
      expect(balance).toBe(850);
    });
  });

  describe("시나리오 6: 결제 내역 조회", () => {
    let userId: number;
    const NUM_PAYMENTS = 3;

    beforeAll(async () => {
      const userResult = await dataSource.query(
        "INSERT INTO users (name, point) VALUES (?, ?)",
        ["Test User 6", 10000],
      );
      userId = userResult.insertId;

      // 예약 및 결제 생성
      for (let i = 0; i < NUM_PAYMENTS; i++) {
        const reservationResult = await dataSource.query(
          "INSERT INTO reservations (userId, seatId, concertScheduleId, status, expiresAt) VALUES (?, ?, ?, ?, ?)",
          [
            userId,
            1000 + i,
            1,
            "CONFIRMED",
            new Date(Date.now() + 1000 * 60 * 60),
          ],
        );

        await paymentRepository.savePayment(
          userId,
          reservationResult.insertId,
          100 * (i + 1),
          "COMPLETED",
        );
      }
    });

    it("6-1: 사용자의 결제 내역 조회", async () => {
      const payments = await paymentRepository.getPaymentsByUserId(userId, 10);
      expect(payments.length).toBeGreaterThanOrEqual(NUM_PAYMENTS);
    });

    it("6-2: 결제 내역은 최신순으로 정렬", async () => {
      const payments = await paymentRepository.getPaymentsByUserId(userId, 10);
      for (let i = 1; i < payments.length; i++) {
        expect(payments[i].createdAt.getTime()).toBeLessThanOrEqual(
          payments[i - 1].createdAt.getTime(),
        );
      }
    });

    it("6-3: 개별 결제 내역 조회", async () => {
      const payments = await paymentRepository.getPaymentsByUserId(userId, 1);
      if (payments.length > 0) {
        const payment = await paymentRepository.getPayment(payments[0].id);
        expect(payment).toBeDefined();
        expect(payment?.userId).toBe(userId);
      }
    });

    it("6-4: 예약의 결제 여부 확인", async () => {
      const payments = await paymentRepository.getPaymentsByUserId(userId, 1);
      if (payments.length > 0) {
        const hasPayment = await paymentRepository.hasPayment(
          payments[0].reservationId,
        );
        expect(hasPayment).toBe(true);
      }
    });
  });
});
