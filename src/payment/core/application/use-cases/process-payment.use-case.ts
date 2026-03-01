import { PaymentEntity } from "../../domain/entities/payment.entity";
import { Money } from "../../domain/value-objects/money.value-object";
import { IPaymentRepository } from "../../domain/repositories/payment.repository";
import { IUserRepositoryPort } from "../ports/user-repository.port";
import { IReservationRepositoryPort } from "../ports/reservation-repository.port";
import { IConcertScheduleRepositoryPort } from "../ports/concert-schedule-repository.port";
import { IPaymentGatewayPort } from "../ports/payment-gateway.port";
import {
  IEventPublisherPort,
  PaymentEvent,
} from "../ports/event-publisher.port";
import { IQueueServicePort } from "../ports/queue-service.port";
import { ProcessPaymentInputDto } from "../dto/process-payment.input.dto";
import { ProcessPaymentOutputDto } from "../dto/process-payment.output.dto";

/**
 * ProcessPaymentUseCase
 * 결제 처리의 핵심 비즈니스 로직을 담당하는 UseCase
 *
 * 책임:
 * 1. 예약 확인
 * 2. 콘서트 가격 조회
 * 3. 사용자 포인트 확인
 * 4. 결제 게이트웨이를 통한 결제 처리
 * 5. 결제 엔티티 생성 및 저장
 * 6. 이벤트 발행
 * 7. 대기열 토큰 만료
 */
export class ProcessPaymentUseCase {
  constructor(
    private readonly paymentRepository: IPaymentRepository,
    private readonly userRepository: IUserRepositoryPort,
    private readonly reservationRepository: IReservationRepositoryPort,
    private readonly concertScheduleRepository: IConcertScheduleRepositoryPort,
    private readonly paymentGateway: IPaymentGatewayPort,
    private readonly eventPublisher: IEventPublisherPort,
    private readonly queueService: IQueueServicePort,
  ) {}

  async execute(
    input: ProcessPaymentInputDto,
  ): Promise<ProcessPaymentOutputDto> {
    // 1. 예약 확인
    const reservation = await this.reservationRepository.getReservation(
      input.reservationId,
    );
    if (!reservation) {
      throw new Error("예약을 찾을 수 없습니다.");
    }

    // 사용자 일치 확인
    if (reservation.userId !== input.userId) {
      throw new Error("예약한 사용자만 결제할 수 있습니다.");
    }

    // 2. 콘서트 일정 및 가격 조회
    const schedule = await this.concertScheduleRepository.getSchedule(
      reservation.concertScheduleId,
    );
    if (!schedule) {
      throw new Error("콘서트 일정을 찾을 수 없습니다.");
    }

    const amount = Money.create(schedule.price);

    // 3. 사용자 포인트 확인
    const userPoint = await this.userRepository.getUserPoint(input.userId);
    if (userPoint < amount.getValue()) {
      throw new Error("사용자의 포인트가 부족합니다.");
    }

    // 4. 결제 게이트웨이를 통한 결제 처리
    const paymentResult = await this.paymentGateway.processPayment(
      input.userId,
      amount.getValue(),
    );

    if (!paymentResult.success) {
      throw new Error(
        `결제 처리 실패: ${paymentResult.errorMessage || "알 수 없는 오류"}`,
      );
    }

    // 5. 예약 상태 확정
    await this.reservationRepository.confirmReservation(
      input.reservationId,
      input.userId,
    );

    // 6. 사용자 포인트 차감
    const deductSuccess = await this.userRepository.deductPoint(
      input.userId,
      amount.getValue(),
    );
    if (!deductSuccess) {
      throw new Error("포인트 차감에 실패했습니다.");
    }

    // 7. 결제 엔티티 생성 및 저장
    const payment = PaymentEntity.create(
      input.userId,
      input.reservationId,
      amount,
    );
    payment.complete();
    const savedPayment = await this.paymentRepository.save(payment);

    // 8. 결제 완료 이벤트 발행
    const event: PaymentEvent = {
      type: "PAYMENT_COMPLETED",
      paymentId: savedPayment.getId()!,
      userId: input.userId,
      reservationId: input.reservationId,
      amount: amount.getValue(),
      timestamp: new Date(),
    };
    await this.eventPublisher.publishPaymentEvent(event);

    // 9. 대기열 토큰 만료
    if (input.queueToken) {
      await this.queueService.expireToken(input.queueToken);
    }

    // 결과 반환
    return new ProcessPaymentOutputDto(
      savedPayment.getId()!,
      savedPayment.getUserId(),
      savedPayment.getReservationId(),
      savedPayment.getAmount().getValue(),
      savedPayment.getStatus().getValue(),
      savedPayment.getCreatedAt(),
    );
  }
}
