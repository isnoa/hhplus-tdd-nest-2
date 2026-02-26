/**
 * Payment Repository Interface
 * 결제 정보 관리를 위한 인터페이스
 */
export interface IPaymentRepository {
  /**
   * 결제 기록 저장
   */
  savePayment(
    userId: number,
    reservationId: number,
    amount: number,
    status: string,
  ): Promise<{ id: number; createdAt: Date }>;

  /**
   * 결제 내역 조회
   */
  getPayment(paymentId: number): Promise<{
    id: number;
    userId: number;
    reservationId: number;
    amount: number;
    status: string;
    createdAt: Date;
  } | null>;

  /**
   * 사용자의 결제 내역 조회
   */
  getPaymentsByUserId(userId: number, limit?: number): Promise<
    Array<{
      id: number;
      reservationId: number;
      amount: number;
      status: string;
      createdAt: Date;
    }>
  >;

  /**
   * 예약의 결제 여부 확인
   */
  hasPayment(reservationId: number): Promise<boolean>;

  /**
   * 결제 상태 업데이트
   */
  updatePaymentStatus(
    paymentId: number,
    status: string,
  ): Promise<boolean>;
}
