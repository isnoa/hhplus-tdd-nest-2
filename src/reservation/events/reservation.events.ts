/**
 * 예약 관련 이벤트 정의
 */

export class ReservationCreatedEvent {
  constructor(
    public readonly reservationId: number,
    public readonly userId: number,
    public readonly concertId: number,
    public readonly concertScheduleId: number,
    public readonly seatId: number,
    public readonly timestamp: Date,
  ) {}
}

export class ReservationConfirmedEvent {
  constructor(
    public readonly reservationId: number,
    public readonly userId: number,
    public readonly concertId: number,
    public readonly concertScheduleId: number,
    public readonly seatId: number,
    public readonly timestamp: Date,
  ) {}
}

export class ReservationCancelledEvent {
  constructor(
    public readonly reservationId: number,
    public readonly userId: number,
    public readonly concertId: number,
    public readonly concertScheduleId: number,
    public readonly seatId: number,
    public readonly timestamp: Date,
    public readonly reason: string,
  ) {}
}
