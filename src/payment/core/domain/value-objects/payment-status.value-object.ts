/**
 * PaymentStatus Value Object
 * 결제 상태를 나타내는 불변 Value Object
 */
export enum PaymentStatusEnum {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export class PaymentStatus {
  private readonly status: PaymentStatusEnum;

  private constructor(status: PaymentStatusEnum) {
    this.status = status;
  }

  static pending(): PaymentStatus {
    return new PaymentStatus(PaymentStatusEnum.PENDING);
  }

  static completed(): PaymentStatus {
    return new PaymentStatus(PaymentStatusEnum.COMPLETED);
  }

  static failed(): PaymentStatus {
    return new PaymentStatus(PaymentStatusEnum.FAILED);
  }

  static cancelled(): PaymentStatus {
    return new PaymentStatus(PaymentStatusEnum.CANCELLED);
  }

  getValue(): PaymentStatusEnum {
    return this.status;
  }

  isCompleted(): boolean {
    return this.status === PaymentStatusEnum.COMPLETED;
  }

  isPending(): boolean {
    return this.status === PaymentStatusEnum.PENDING;
  }
}
