import { Injectable } from "@nestjs/common";
import { ProcessPaymentOutputDto } from "../../core/application/dto/process-payment.output.dto";

/**
 * PaymentPresenter
 * UseCase의 결과를 HTTP 응답으로 변환하는 Presenter
 */
@Injectable()
export class PaymentPresenter {
  presentPaymentResult(output: ProcessPaymentOutputDto): {
    id: number;
    userId: number;
    reservationId: number;
    amount: number;
    status: string;
    createdAt: Date;
  } {
    return {
      id: output.id,
      userId: output.userId,
      reservationId: output.reservationId,
      amount: output.amount,
      status: output.status,
      createdAt: output.createdAt,
    };
  }
}
