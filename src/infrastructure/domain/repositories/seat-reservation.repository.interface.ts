/**
 * Seat Reservation Repository Interface
 * 임시 좌석 배정 및 상태 관리를 위한 인터페이스
 */
export interface ISeatReservationRepository {
  /**
   * 좌석을 임시로 예약
   * @returns 성공 여부
   */
  reserveSeatTemporarily(
    seatId: number,
    userId: number,
    tempReservedUntil: Date,
  ): Promise<boolean>;

  /**
   * 임시 예약 확인
   */
  isTemporarilyReserved(seatId: number): Promise<boolean>;

  /**
   * 임시 예약 자세히 조회
   */
  getTemporaryReservation(seatId: number): Promise<{
    userId: number;
    expiresAt: Date;
  } | null>;

  /**
   * 임시 예약을 영구 예약으로 전환
   */
  confirmReservation(seatId: number, reservationId: number): Promise<boolean>;

  /**
   * 임시 예약 취소
   */
  cancelTemporaryReservation(seatId: number): Promise<void>;

  /**
   * 만료된 임시 예약 자동 해제
   * @returns 해제된 좌석 개수
   */
  releaseExpiredReservations(): Promise<number>;

  /**
   * 좌석 상태 조회
   */
  getSeatStatus(
    seatId: number,
  ): Promise<"AVAILABLE" | "TEMP_RESERVED" | "RESERVED">;

  /**
   * 콘서트 스케줄의 사용 가능한 좌석 개수
   */
  getAvailableSeatsCount(concertScheduleId: number): Promise<number>;

  /**
   * 사용자가 예약한 좌석들
   */
  getUserReservedSeats(userId: number): Promise<number[]>;
}
