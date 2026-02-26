import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PaymentEntity } from "../../core/domain/entities/payment.entity";
import { IPaymentRepository } from "../../core/domain/repositories/payment.repository";
import { Money } from "../../core/domain/value-objects/money.value-object";
import {
  PaymentStatus,
  PaymentStatusEnum,
} from "../../core/domain/value-objects/payment-status.value-object";
import { Payment } from "../../entities/payment.entity";

/**
 * PaymentPersistenceRepository
 * Database를 통한 Payment 저장소 구현
 */
@Injectable()
export class PaymentPersistenceRepository implements IPaymentRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async save(payment: PaymentEntity): Promise<PaymentEntity> {
    const entity = this.paymentRepository.create({
      userId: payment.getUserId(),
      reservationId: payment.getReservationId(),
      amount: payment.getAmount().getValue(),
      status: payment.getStatus().getValue() as any,
    } as any);

    const saved = await this.paymentRepository.save(entity as any);

    return this.toDomain(saved as any);
  }

  async findById(id: number): Promise<PaymentEntity | null> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
    });

    return payment ? this.toDomain(payment) : null;
  }

  async findByReservationId(
    reservationId: number,
  ): Promise<PaymentEntity | null> {
    const payment = await this.paymentRepository.findOne({
      where: { reservationId },
    });

    return payment ? this.toDomain(payment) : null;
  }

  async findByUserId(userId: number): Promise<PaymentEntity[]> {
    const payments = await this.paymentRepository.find({
      where: { userId },
    });

    return payments.map((p) => this.toDomain(p));
  }

  /**
   * DATABASE 엔티티를 Domain 엔티티로 변환
   */
  private toDomain(payment: Payment): PaymentEntity {
    const status = this.mapStatusToDomain(
      payment.status as unknown as PaymentStatusEnum,
    );
    return PaymentEntity.reconstruct(
      payment.id,
      payment.userId,
      payment.reservationId,
      Money.create(payment.amount),
      status,
      payment.createdAt,
      // Payment 엔티티에 updatedAt이 없으므로 createdAt 동일값 전달
      payment.createdAt,
    );
  }

  private mapStatusToDomain(status: PaymentStatusEnum): PaymentStatus {
    switch (status) {
      case PaymentStatusEnum.PENDING:
        return PaymentStatus.pending();
      case PaymentStatusEnum.COMPLETED:
        return PaymentStatus.completed();
      case PaymentStatusEnum.FAILED:
        return PaymentStatus.failed();
      case PaymentStatusEnum.CANCELLED:
        return PaymentStatus.cancelled();
      default:
        throw new Error(`Unknown payment status: ${status}`);
    }
  }
}
