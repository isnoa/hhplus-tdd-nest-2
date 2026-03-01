/**
 * ProcessPaymentInputDto
 * ProcessPaymentUseCase의 입력 DTO
 */
export class ProcessPaymentInputDto {
  constructor(
    readonly userId: number,
    readonly reservationId: number,
    readonly queueToken?: string,
  ) {}
}
