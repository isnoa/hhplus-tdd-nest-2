/**
 * PaymentGateway Port Interface
 * 외부 결제 게이트웨이와 상호작용하기 위한 Port
 * 테스트에서 Mock으로 대체될 수 있는 외부 의존성
 */
export interface IPaymentGatewayPort {
  processPayment(
    userId: number,
    amount: number,
  ): Promise<{
    success: boolean;
    transactionId?: string;
    errorMessage?: string;
  }>;

  refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<{
    success: boolean;
    errorMessage?: string;
  }>;
}
