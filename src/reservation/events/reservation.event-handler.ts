import { Injectable, Logger, Optional } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  ReservationConfirmedEvent,
  ReservationCreatedEvent,
} from "./reservation.events";
import {
  DataPlatformApiClient,
  DataPlatformPayload,
} from "../../infrastructure/external-api/data-platform.api-client";
import { KafkaProducerService } from "../../infrastructure/external-api/kafka-producer.service";

/**
 * 예약 이벤트 핸들러
 * 이벤트를 수신하여 외부 데이터 플랫폼에 데이터를 전송합니다.
 * 트랜잭션과 관심사를 분리하여 서비스를 개선합니다.
 */
@Injectable()
export class ReservationEventHandler {
  private readonly logger = new Logger(ReservationEventHandler.name);
  private readonly useKafka: boolean;

  constructor(
    private readonly dataPlatformApiClient: DataPlatformApiClient,
    @Optional() private readonly kafkaProducerService?: KafkaProducerService,
  ) {
    this.useKafka =
      this.kafkaProducerService !== undefined &&
      (process.env.USE_KAFKA === "true" || process.env.USE_KAFKA === "1");

    if (this.useKafka) {
      this.logger.log("ReservationEventHandler initialized in Kafka mode");
    } else {
      this.logger.log("ReservationEventHandler initialized in Legacy mode");
    }
  }

  /**
   * 예약 생성 이벤트 처리
   * Kafka 모드: 이벤트를 Kafka 토픽으로 발행
   * Legacy 모드: 데이터 플랫폼 API로 직접 전송
   */
  @OnEvent("reservation.created")
  async handleReservationCreated(event: ReservationCreatedEvent) {
    this.logger.log(
      `Handling reservation.created event - Reservation ID: ${event.reservationId}`,
    );

    try {
      if (this.useKafka && this.kafkaProducerService) {
        // Kafka 모드: 이벤트를 토픽으로 발행
        await this.kafkaProducerService.publishReservationCreatedEvent({
          reservationId: event.reservationId,
          userId: event.userId,
          concertId: event.concertId,
          concertScheduleId: event.concertScheduleId,
          seatId: event.seatId,
          timestamp: event.timestamp.toISOString(),
        });

        this.logger.log(
          `Successfully published reservation.created event to Kafka (Reservation ID: ${event.reservationId})`,
        );
      } else {
        // Legacy 모드: 데이터 플랫폼 API로 직접 전송
        const payload: DataPlatformPayload = {
          reservationId: event.reservationId,
          userId: event.userId,
          concertId: event.concertId,
          concertScheduleId: event.concertScheduleId,
          seatId: event.seatId,
          timestamp: event.timestamp.toISOString(),
        };

        const result =
          await this.dataPlatformApiClient.sendReservationData(payload);

        if (result) {
          this.logger.log(
            `Successfully sent reservation created data to platform (Reservation ID: ${event.reservationId})`,
          );
        } else {
          this.logger.warn(
            `Failed to send reservation created data to platform (Reservation ID: ${event.reservationId})`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error handling reservation.created event: ${error.message}`,
        error.stack,
      );
      // 이벤트 핸들러 실패는 예약 프로세스를 방해하지 않음
    }
  }

  /**
   * 예약 확인 이벤트 처리
   * Kafka 모드: 이벤트를 Kafka 토픽으로 발행
   * Legacy 모드: 데이터 플랫폼 API로 직접 전송
   */
  @OnEvent("reservation.confirmed")
  async handleReservationConfirmed(event: ReservationConfirmedEvent) {
    this.logger.log(
      `Handling reservation.confirmed event - Reservation ID: ${event.reservationId}`,
    );

    try {
      if (this.useKafka && this.kafkaProducerService) {
        // Kafka 모드: 이벤트를 토픽으로 발행
        await this.kafkaProducerService.publishReservationConfirmedEvent({
          reservationId: event.reservationId,
          userId: event.userId,
          concertId: event.concertId,
          concertScheduleId: event.concertScheduleId,
          seatId: event.seatId,
          timestamp: event.timestamp.toISOString(),
        });

        this.logger.log(
          `Successfully published reservation.confirmed event to Kafka (Reservation ID: ${event.reservationId})`,
        );
      } else {
        // Legacy 모드: 데이터 플랫폼 API로 직접 전송
        const payload: DataPlatformPayload = {
          reservationId: event.reservationId,
          userId: event.userId,
          concertId: event.concertId,
          concertScheduleId: event.concertScheduleId,
          seatId: event.seatId,
          timestamp: event.timestamp.toISOString(),
        };

        const result =
          await this.dataPlatformApiClient.sendReservationData(payload);

        if (result) {
          this.logger.log(
            `Successfully sent reservation confirmed data to platform (Reservation ID: ${event.reservationId})`,
          );
        } else {
          this.logger.warn(
            `Failed to send reservation confirmed data to platform (Reservation ID: ${event.reservationId})`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error handling reservation.confirmed event: ${error.message}`,
        error.stack,
      );
      // 이벤트 핸들러 실패는 예약 프로세스를 방해하지 않음
    }
  }
}
