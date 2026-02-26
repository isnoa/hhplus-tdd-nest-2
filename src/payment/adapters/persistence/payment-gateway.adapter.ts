import { Injectable } from "@nestjs/common";
import { IPaymentGatewayPort } from "../../core/application/ports/payment-gateway.port";

/**
 * PaymentGatewayAdapter
 * 외부 결제 게이트웨이와 통신하는 Adapter
 * 테스트에서는 Mock으로 대체 가능
 */
@Injectable()
export class PaymentGatewayAdapter implements IPaymentGatewayPort {
  /**
   * 외부 결제 게이트웨이를 통한 결제 처리
   * 실제 구현에서는 외부 API를 호출
   */
  async processPayment(
    userId: number,
    amount: number,
  ): Promise<{
    success: boolean;
    transactionId?: string;
    errorMessage?: string;
  }> {
    try {
      // TODO: 실제 결제 게이트웨이 API 호출
      // 현재는 성공 시뮬레이션
      const transactionId = `TXN_${Date.now()}_${userId}`;
      return {
        success: true,
        transactionId,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "결제 처리 중 오류가 발생했습니다.",
      };
    }
  }

  /**
   * 외부 결제 게이트웨이를 통한 환불 처리
   */
  async refundPayment(
    transactionId: string,
    amount: number,
  ): Promise<{
    success: boolean;
    errorMessage?: string;
  }> {
    try {
      // TODO: 실제 환불 API 호출
      return { success: true };
    } catch (error) {
      return {
        success: false,
        errorMessage:
          error instanceof Error
            ? error.message
            : "환불 처리 중 오류가 발생했습니다.",
      };
    }
  }
}
