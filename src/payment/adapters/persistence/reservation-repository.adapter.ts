import { Injectable } from "@nestjs/common";
import {
  IReservationRepositoryPort,
  ReservationData,
} from "../../core/application/ports/reservation-repository.port";
import { ReservationService } from "../../../reservation/reservation.service";

/**
 * ReservationRepositoryAdapter
 * ReservationService를 통해 예약 데이터에 접근하는 Adapter
 */
@Injectable()
export class ReservationRepositoryAdapter
  implements IReservationRepositoryPort
{
  constructor(private readonly reservationService: ReservationService) {}

  async getReservation(reservationId: number): Promise<ReservationData | null> {
    try {
      const reservation =
        await this.reservationService.getReservation(reservationId);
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
    // ReservationService.confirmReservation requires a manager, not available here.
    throw new Error("confirmReservation not supported by adapter");
  }

  async cancelReservation(reservationId: number): Promise<boolean> {
    // ReservationService does not support cancelReservation currently
    return false;
  }
}
