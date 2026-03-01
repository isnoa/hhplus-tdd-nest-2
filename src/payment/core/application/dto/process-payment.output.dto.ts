import { PaymentStatusEnum } from "../../domain/value-objects/payment-status.value-object";

/**
 * ProcessPaymentOutputDto
 * ProcessPaymentUseCase의 출력 DTO
 */
export class ProcessPaymentOutputDto {
  constructor(
    readonly id: number,
    readonly userId: number,
    readonly reservationId: number,
    readonly amount: number,
    readonly status: PaymentStatusEnum,
    readonly createdAt: Date,
  ) {}
}
