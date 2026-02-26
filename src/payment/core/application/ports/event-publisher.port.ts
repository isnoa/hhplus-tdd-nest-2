/**
 * Event Publisher Port Interface
 * 결제 완료, 취소 등의 이벤트를 발행하기 위한 Port
 */
export interface PaymentEvent {
  type: "PAYMENT_COMPLETED" | "PAYMENT_FAILED" | "PAYMENT_CANCELLED";
  paymentId: number;
  userId: number;
  reservationId: number;
  amount: number;
  timestamp: Date;
}

export interface IEventPublisherPort {
  publishPaymentEvent(event: PaymentEvent): Promise<void>;
}
