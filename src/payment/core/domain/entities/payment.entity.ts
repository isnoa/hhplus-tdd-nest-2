import { Money } from "../value-objects/money.value-object";
import {
  PaymentStatus,
  PaymentStatusEnum,
} from "../value-objects/payment-status.value-object";
export class PaymentEntity {
  private id: number | null;
  private readonly userId: number;
  private readonly reservationId: number;
  private readonly amount: Money;
  private status: PaymentStatus;
  private readonly createdAt: Date;
  private updatedAt: Date;

  private constructor(
    userId: number,
    reservationId: number,
    amount: Money,
    status: PaymentStatus = PaymentStatus.pending(),
    id: number | null = null,
    createdAt: Date = new Date(),
    updatedAt: Date = new Date(),
  ) {
    this.id = id;
    this.userId = userId;
    this.reservationId = reservationId;
    this.amount = amount;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static create(
    userId: number,
    reservationId: number,
    amount: Money,
  ): PaymentEntity {
    return new PaymentEntity(userId, reservationId, amount);
  }

  static reconstruct(
    id: number,
    userId: number,
    reservationId: number,
    amount: Money,
    status: PaymentStatus,
    createdAt: Date,
    updatedAt: Date,
  ): PaymentEntity {
    return new PaymentEntity(
      userId,
      reservationId,
      amount,
      status,
      id,
      createdAt,
      updatedAt,
    );
  }

  complete(): void {
    if (!this.status.isPending()) {
      throw new Error("대기 중인 결제만 완료 처리할 수 있습니다.");
    }
    this.status = PaymentStatus.completed();
    this.updatedAt = new Date();
  }

  fail(): void {
    if (this.status.isCompleted()) {
      throw new Error("완료된 결제는 실패 처리할 수 없습니다.");
    }
    this.status = PaymentStatus.failed();
    this.updatedAt = new Date();
  }

  // Getters
  getId(): number | null {
    return this.id;
  }

  getUserId(): number {
    return this.userId;
  }

  getReservationId(): number {
    return this.reservationId;
  }

  getAmount(): Money {
    return this.amount;
  }

  getStatus(): PaymentStatus {
    return this.status;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  isCompleted(): boolean {
    return this.status.isCompleted();
  }
}
