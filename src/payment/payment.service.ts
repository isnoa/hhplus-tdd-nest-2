import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ReservationService } from '../reservation/reservation.service';
import { UserService } from '../user/user.service';
import { QueueService } from '../queue/queue.service';
import { ConcertSchedule } from '../concert/entities/concert-schedule.entity';
import { Reservation } from '../reservation/entities/reservation.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly reservationService: ReservationService,
    private readonly userService: UserService,
    private readonly queueService: QueueService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Process payment for a reservation.
   * 1. Confirm the reservation (locks seat, marks CONFIRMED).
   * 2. Deduct points from user.
   * 3. Create payment record.
   * 4. Expire the queue token.
   */
  async processPayment(
    userId: number,
    queueToken: string,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    return await this.dataSource.transaction(async (manager) => {
      // 예약 확정 및 좌석 락
      const reservation = await this.reservationService.confirmReservation(
        dto.reservationId,
        userId,
        manager,
      );

      // 가격 조회
      const schedule = await manager.findOne(ConcertSchedule, {
        where: { id: reservation.concertScheduleId },
      });
      if (!schedule) throw new NotFoundException('콘서트 일정을 찾을 수 없습니다.');

      const price = schedule.price;

      // 포인트 차감
      await this.userService.deductPoint(userId, price, manager);

      // 결제 내역 저장
      const payment = manager.create(Payment, {
        userId,
        reservationId: reservation.id,
        amount: price,
      });
      return manager.save(payment);
    }).then(async (payment) => {
      // 결제 후 대기열 토큰 만료 처리
      await this.queueService.expireToken(queueToken);
      return payment;
    });
  }
}
