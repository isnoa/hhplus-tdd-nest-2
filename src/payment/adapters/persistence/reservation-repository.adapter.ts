import { Injectable } from "@nestjs/common";
import {
  IReservationRepositoryPort,
  ReservationData,
} from "../../../core/application/ports/reservation-repository.port";
import { ReservationService } from "../../../reservation/reservation.service";

/**
 * ReservationRepositoryAdapter
 * ReservationService를 통해 예약 데이터에 접근하는 Adapter
 */
@Injectable()
export class ReservationRepositoryAdapter implements IReservationRepositoryPort {
  constructor(private readonly reservationService: ReservationService) {}

  async getReservation(reservationId: number): Promise<ReservationData | null> {
    try {
      const reservation = await this.reservationService.findById(reservationId);
      if (!reservation) return null;

      return {
        id: reservation.id,
        userId: reservation.userId,
        seatId: reservation.seatId,
        concertScheduleId: reservation.concertScheduleId,
        status: reservation.status,
        createdAt: reservation.createdAt,
      };
    } catch (error) {
      return null;
    }
  }

  async confirmReservation(
    reservationId: number,
    userId: number,
  ): Promise<ReservationData> {
    const reservation = await this.reservationService.confirmReservation(
      reservationId,
      userId,
    );

    return {
      id: reservation.id,
      userId: reservation.userId,
      seatId: reservation.seatId,
      concertScheduleId: reservation.concertScheduleId,
      status: reservation.status,
      createdAt: reservation.createdAt,
    };
  }

  async cancelReservation(reservationId: number): Promise<boolean> {
    try {
      await this.reservationService.cancelReservation(reservationId);
      return true;
    } catch (error) {
      return false;
    }
  }
}
