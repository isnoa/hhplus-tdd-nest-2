import { Injectable } from "@nestjs/common";
import {
  IEventPublisherPort,
  PaymentEvent,
} from "../../core/application/ports/event-publisher.port";

/**
 * EventPublisherAdapter
 * 결제 관련 이벤트를 발행하는 Adapter
 * 실제 구현에서는 메시지 브로커(RabbitMQ, Kafka 등)와 통신
 */
@Injectable()
export class EventPublisherAdapter implements IEventPublisherPort {
  /**
   * 결제 이벤트 발행
   * 실제 구현에서는 메시지 브로커에 발행
   */
  async publishPaymentEvent(event: PaymentEvent): Promise<void> {
    try {
      // TODO: 실제 이벤트 브로커에 발행
      // 로그를 통해 이벤트 발행 확인
      console.log("[Event Published]", {
        type: event.type,
        paymentId: event.paymentId,
        userId: event.userId,
        amount: event.amount,
        timestamp: event.timestamp,
      });
    } catch (error) {
      console.error("[Event Publishing Error]", error);
      // 이벤트 발행 실패는 결제 로직을 실패시키지 않음
      // (이벤트는 결제와 별개)
    }
  }
}
