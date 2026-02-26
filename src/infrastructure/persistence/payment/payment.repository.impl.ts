import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from '../../../payment/entities/payment.entity';
import { PaymentStatus } from '../../../common/enums/payment-status.enum';
import { IPaymentRepository } from '../../domain/repositories/payment.repository.interface';

/**
 * Payment Repository Implementation
 * 결제 정보 관리
 */
@Injectable()
export class PaymentRepository implements IPaymentRepository {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async savePayment(
    userId: number,
    reservationId: number,
    amount: number,
    status: string,
  ): Promise<{ id: number; createdAt: Date }> {
    const statusEnum = status as PaymentStatus;
    const payment = this.paymentRepository.create({
      userId,
      reservationId,
      amount,
      status: statusEnum,
    });

    const saved = await this.paymentRepository.save(payment);
    return {
      id: saved.id,
      createdAt: saved.createdAt,
    };
  }

  async getPayment(
    paymentId: number,
  ): Promise<{
    id: number;
    userId: number;
    reservationId: number;
    amount: number;
    status: string;
    createdAt: Date;
  } | null> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId },
    });

    if (!payment) {
      return null;
    }

    return {
      id: payment.id,
      userId: payment.userId,
      reservationId: payment.reservationId,
      amount: payment.amount,
      status: payment.status,
      createdAt: payment.createdAt,
    };
  }

  async getPaymentsByUserId(
    userId: number,
    limit?: number,
  ): Promise<
    Array<{
      id: number;
      reservationId: number;
      amount: number;
      status: string;
      createdAt: Date;
    }>
  > {
    const payments = await this.paymentRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit ?? 10,
    });

    return payments.map((p) => ({
      id: p.id,
      reservationId: p.reservationId,
      amount: p.amount,
      status: p.status,
      createdAt: p.createdAt,
    }));
  }

  async hasPayment(reservationId: number): Promise<boolean> {
    const count = await this.paymentRepository.count({
      where: { reservationId },
    });

    return count > 0;
  }

  async updatePaymentStatus(paymentId: number, status: string): Promise<boolean> {
    const statusEnum = status as PaymentStatus;
    const result = await this.paymentRepository.update(
      { id: paymentId },
      { status: statusEnum },
    );

    return (result.affected || 0) > 0;
  }
}
