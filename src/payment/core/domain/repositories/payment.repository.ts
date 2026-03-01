import { PaymentEntity } from "../entities/payment.entity";

/**
 * PaymentRepository Interface
 * 결제 데이터 접근을 위한 Repository 인터페이스
 * 레이어드 아키텍처의 의존성 역전을 위해 정의함
 */
export interface IPaymentRepository {
  save(payment: PaymentEntity): Promise<PaymentEntity>;
  findById(id: number): Promise<PaymentEntity | null>;
  findByReservationId(reservationId: number): Promise<PaymentEntity | null>;
  findByUserId(userId: number): Promise<PaymentEntity[]>;
}
