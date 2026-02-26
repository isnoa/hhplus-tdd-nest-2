/**
 * ReservationRepository Port Interface
 * 예약 관련 데이터에 접근하기 위한 외부 Port
 */
export interface ReservationData {
  id: number;
  userId: number;
  seatId: number;
  concertScheduleId: number;
  status: string;
  createdAt: Date;
}

export interface IReservationRepositoryPort {
  getReservation(reservationId: number): Promise<ReservationData | null>;
  confirmReservation(
    reservationId: number,
    userId: number,
  ): Promise<ReservationData>;
  cancelReservation(reservationId: number): Promise<boolean>;
}
