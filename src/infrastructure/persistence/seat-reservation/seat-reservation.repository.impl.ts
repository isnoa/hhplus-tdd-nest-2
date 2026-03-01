import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan } from "typeorm";
import { Seat } from "../../../concert/entities/seat.entity";
import { SeatStatus } from "../../../common/enums/seat-status.enum";
import { ISeatReservationRepository } from "../../domain/repositories/seat-reservation.repository.interface";

/**
 * Seat Reservation Repository Implementation
 * 임시 좌석 배정 및 상태 관리 (Redis 없이 DB 기반)
 */
@Injectable()
export class SeatReservationRepository implements ISeatReservationRepository {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
  ) {}

  async reserveSeatTemporarily(
    seatId: number,
    userId: number,
    tempReservedUntil: Date,
  ): Promise<boolean> {
    const seat = await this.seatRepository.findOne({
      where: { id: seatId },
    });

    if (!seat) {
      return false;
    }

    // 이미 예약된 좌석이면 실패
    if (seat.status !== SeatStatus.AVAILABLE) {
      return false;
    }

    // 임시 예약 상태로 업데이트
    const result = await this.seatRepository.update(
      {
        id: seatId,
        status: SeatStatus.AVAILABLE,
      },
      {
        status: SeatStatus.TEMP_RESERVED,
        tempReservedUserId: userId,
        tempReservedUntil,
      },
    );

    return (result.affected || 0) > 0;
  }

  async isTemporarilyReserved(seatId: number): Promise<boolean> {
    const seat = await this.seatRepository.findOne({
      where: { id: seatId },
    });

    if (!seat) {
      return false;
    }

    // 상태가 TEMP_RESERVED이고 만료되지 않았으면 true
    if (seat.status === SeatStatus.TEMP_RESERVED && seat.tempReservedUntil) {
      return new Date() <= seat.tempReservedUntil;
    }

    return false;
  }

  async getTemporaryReservation(
    seatId: number,
  ): Promise<{ userId: number; expiresAt: Date } | null> {
    const seat = await this.seatRepository.findOne({
      where: { id: seatId },
    });

    if (!seat) {
      return null;
    }

    if (
      seat.status === SeatStatus.TEMP_RESERVED &&
      seat.tempReservedUserId &&
      seat.tempReservedUntil
    ) {
      // 만료되지 않았으면 반환
      if (new Date() <= seat.tempReservedUntil) {
        return {
          userId: seat.tempReservedUserId,
          expiresAt: seat.tempReservedUntil,
        };
      }
    }

    return null;
  }

  async confirmReservation(
    seatId: number,
    reservationId: number,
  ): Promise<boolean> {
    const result = await this.seatRepository.update(
      { id: seatId, status: SeatStatus.TEMP_RESERVED },
      {
        status: SeatStatus.RESERVED,
        tempReservedUserId: null,
        tempReservedUntil: null,
      },
    );

    return (result.affected || 0) > 0;
  }

  async cancelTemporaryReservation(seatId: number): Promise<void> {
    await this.seatRepository.update(
      { id: seatId, status: SeatStatus.TEMP_RESERVED },
      {
        status: SeatStatus.AVAILABLE,
        tempReservedUserId: null,
        tempReservedUntil: null,
      },
    );
  }

  async releaseExpiredReservations(): Promise<number> {
    const result = await this.seatRepository.update(
      {
        status: SeatStatus.TEMP_RESERVED,
        tempReservedUntil: LessThan(new Date()),
      },
      {
        status: SeatStatus.AVAILABLE,
        tempReservedUserId: null,
        tempReservedUntil: null,
      },
    );

    return result.affected || 0;
  }

  async getSeatStatus(
    seatId: number,
  ): Promise<"AVAILABLE" | "TEMP_RESERVED" | "RESERVED"> {
    const seat = await this.seatRepository.findOne({
      where: { id: seatId },
    });

    if (!seat) {
      return "AVAILABLE";
    }

    // TEMP_RESERVED 상태이지만 만료되었으면 AVAILABLE로 간주
    if (
      seat.status === SeatStatus.TEMP_RESERVED &&
      seat.tempReservedUntil &&
      new Date() > seat.tempReservedUntil
    ) {
      return "AVAILABLE";
    }

    return seat.status as any;
  }

  async getAvailableSeatsCount(concertScheduleId: number): Promise<number> {
    const count = await this.seatRepository.count({
      where: {
        concertScheduleId,
        status: SeatStatus.AVAILABLE,
      },
    });

    return count;
  }

  async getUserReservedSeats(userId: number): Promise<number[]> {
    const seats = await this.seatRepository.find({
      where: {
        tempReservedUserId: userId,
        status: SeatStatus.TEMP_RESERVED,
      },
      select: ["id"],
    });

    return seats.map((seat) => seat.id);
  }
}
