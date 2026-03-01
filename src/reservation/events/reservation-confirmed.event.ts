/**
 * Reservation Confirmed Event
 * 예약 확인 시 발행되는 이벤트
 */
export class ReservationConfirmedEvent {
  constructor(
    public readonly reservationId: number,
    public readonly userId: number,
    public readonly concertId: number,
    public readonly concertScheduleId: number,
    public readonly seatId: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}
