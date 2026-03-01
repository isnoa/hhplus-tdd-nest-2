import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { RedisLockService } from "../infrastructure/persistence/redis-lock.service";
import { PopularityRankingService } from "../infrastructure/persistence/popularity-ranking.service";
import { Cron, CronExpression } from "@nestjs/schedule";
import {
  Reservation,
  ReservationStatus,
  TEMP_RESERVATION_MINUTES,
} from "./entities/reservation.entity";
import { Seat, SeatStatus } from "../concert/entities/seat.entity";
import { ConcertSchedule } from "../concert/entities/concert-schedule.entity";
import { CreateReservationDto } from "./dto/create-reservation.dto";

@Injectable()
export class ReservationService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    @InjectRepository(ConcertSchedule)
    private readonly scheduleRepository: Repository<ConcertSchedule>,
    private readonly dataSource: DataSource,
    private readonly redisLockService: RedisLockService,
    private readonly popularityRankingService: PopularityRankingService,
  ) {}

  /**
   * Reserve a seat.
   * - Uses pessimistic write lock on the seat row to prevent race conditions.
   * - Temp reservation: TEMP_RESERVATION_MINUTES minutes.
   */
  async createReservation(
    userId: number,
    dto: CreateReservationDto,
  ): Promise<Reservation> {
    // distributed redis lock to guard seat across instances
    const lockKey = `seat:${dto.concertScheduleId}:${dto.seatNumber}`;
    const locked = await this.redisLockService.acquire(lockKey, 5000);
    if (!locked) {
      throw new ConflictException(
        "다른 예약 요청이 진행 중입니다. 잠시 후 다시 시도해주세요.",
      );
    }
    try {
      return await this.dataSource.transaction(async (manager) => {
        // 일정 유효성 검사
        const schedule = await manager.findOne(ConcertSchedule, {
          where: { id: dto.concertScheduleId },
        });
        if (!schedule)
          throw new NotFoundException("콘서트 일정을 찾을 수 없습니다.");

        // 좌석에 락 걸기
        const seat = await manager
          .createQueryBuilder(Seat, "seat")
          .setLock("pessimistic_write")
          .where(
            "seat.concertScheduleId = :scheduleId AND seat.seatNumber = :seatNumber",
            {
              scheduleId: dto.concertScheduleId,
              seatNumber: dto.seatNumber,
            },
          )
          .getOne();

        if (!seat) throw new NotFoundException("좌석을 찾을 수 없습니다.");

        // 만료된 임시 예약 좌석 해제
        if (
          seat.status === SeatStatus.TEMP_RESERVED &&
          seat.tempReservedUntil &&
          seat.tempReservedUntil <= new Date()
        ) {
          seat.status = SeatStatus.AVAILABLE;
          seat.tempReservedUntil = null;
          seat.tempReservedUserId = null;
        }

        if (seat.status !== SeatStatus.AVAILABLE) {
          throw new ConflictException("이미 예약된 좌석입니다.");
        }

        const now = new Date();
        const expiresAt = new Date(
          now.getTime() + TEMP_RESERVATION_MINUTES * 60 * 1000,
        );

        // 좌석 임시 배정
        seat.status = SeatStatus.TEMP_RESERVED;
        seat.tempReservedUntil = expiresAt;
        seat.tempReservedUserId = userId;
        await manager.save(seat);

        // 예약 엔티티 생성
        const reservation = manager.create(Reservation, {
          userId,
          seatId: seat.id,
          concertScheduleId: dto.concertScheduleId,
          status: ReservationStatus.PENDING,
          expiresAt,
        });
        return manager.save(reservation);
      });
    } finally {
      await this.redisLockService.release(lockKey);
    }
  }

  async getReservation(reservationId: number): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
    });
    if (!reservation) throw new NotFoundException("예약을 찾을 수 없습니다.");
    return reservation;
  }

  /**
   * Confirm a reservation after payment.
   * Must be called inside a transaction or with the provided manager.
   */
  async confirmReservation(
    reservationId: number,
    userId: number,
    manager: import("typeorm").EntityManager,
  ): Promise<Reservation> {
    const reservation = await manager.findOne(Reservation, {
      where: { id: reservationId, userId },
    });
    if (!reservation) throw new NotFoundException("예약을 찾을 수 없습니다.");

    if (reservation.status === ReservationStatus.EXPIRED) {
      throw new BadRequestException("만료된 예약입니다.");
    }
    if (reservation.status === ReservationStatus.CONFIRMED) {
      throw new ConflictException("이미 결제된 예약입니다.");
    }
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException("결제 가능한 상태의 예약이 아닙니다.");
    }
    if (reservation.expiresAt < new Date()) {
      reservation.status = ReservationStatus.EXPIRED;
      await manager.save(reservation);
      throw new BadRequestException(
        "임시 배정이 만료된 예약입니다. 다시 예약해주세요.",
      );
    }

    // 결제 완료 시 좌석 확정
    const seat = await manager
      .createQueryBuilder(Seat, "seat")
      .setLock("pessimistic_write")
      .where("seat.id = :id", { id: reservation.seatId })
      .getOne();

    if (seat) {
      seat.status = SeatStatus.RESERVED;
      seat.tempReservedUntil = null;
      seat.tempReservedUserId = null;
      await manager.save(seat);
    }

    reservation.status = ReservationStatus.CONFIRMED;
    const confirmedReservation = await manager.save(reservation);

    // 인기도 랭킹 업데이트 (비동기로 수행)
    try {
      const schedule = await manager.findOne(ConcertSchedule, {
        where: { id: reservation.concertScheduleId },
      });
      if (schedule) {
        this.popularityRankingService
          .recordReservation(schedule.concertId, schedule.id, schedule.totalSeats)
          .catch((error) => {
            console.error(
              "Failed to record popularity ranking:",
              error,
            );
          });
      }
    } catch (error) {
      console.error("Error updating popularity ranking:", error);
    }

    return confirmedReservation;
  }

  /**
   * Scheduled task to release expired temp reservations.
   * Runs every minute to clean up timed-out seat allocations.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async releaseExpiredTempReservations(): Promise<void> {
    return await this.dataSource.transaction(async (manager) => {
      const now = new Date();

      // 만료된 임시 예약 좌석 찾기
      const expiredSeats = await manager
        .createQueryBuilder(Seat, "seat")
        .where("seat.status = :status", { status: SeatStatus.TEMP_RESERVED })
        .andWhere("seat.tempReservedUntil <= :now", { now })
        .getMany();

      // 좌석 상태 해제
      for (const seat of expiredSeats) {
        seat.status = SeatStatus.AVAILABLE;
        seat.tempReservedUntil = null;
        seat.tempReservedUserId = null;
        await manager.save(seat);
      }

      // 임시 예약 상태 EXPIRED로 변경
      await manager
        .createQueryBuilder(Reservation, "reservation")
        .update(Reservation)
        .set({ status: ReservationStatus.EXPIRED })
        .where("reservation.status = :status", {
          status: ReservationStatus.PENDING,
        })
        .andWhere("reservation.expiresAt <= :now", { now })
        .execute();
    });
  }
}
