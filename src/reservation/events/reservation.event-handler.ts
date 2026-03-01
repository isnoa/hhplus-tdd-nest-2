import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ReservationConfirmedEvent,
  ReservationCreatedEvent,
} from './reservation.events';
import {
  DataPlatformApiClient,
  DataPlatformPayload,
} from '../../infrastructure/external-api/data-platform.api-client';

/**
 * 예약 이벤트 핸들러
 * 이벤트를 수신하여 외부 데이터 플랫폼에 데이터를 전송합니다.
 * 트랜잭션과 관심사를 분리하여 서비스를 개선합니다.
 */
@Injectable()
export class ReservationEventHandler {
  private readonly logger = new Logger(ReservationEventHandler.name);

  constructor(
    private readonly dataPlatformApiClient: DataPlatformApiClient,
  ) {}

  /**
   * 예약 생성 이벤트 처리
   * 예약이 생성되면 데이터 플랫폼에 전송합니다.
   */
  @OnEvent('reservation.created')
  async handleReservationCreated(event: ReservationCreatedEvent) {
    this.logger.log(
      `Handling reservation.created event - Reservation ID: ${event.reservationId}`,
    );

    const payload: DataPlatformPayload = {
      reservationId: event.reservationId,
      userId: event.userId,
      concertId: event.concertId,
      concertScheduleId: event.concertScheduleId,
      seatId: event.seatId,
      timestamp: event.timestamp.toISOString(),
    };

    try {
      const result = await this.dataPlatformApiClient.sendReservationData(
        payload,
      );

      if (result) {
        this.logger.log(
          `Successfully sent reservation created data to platform (Reservation ID: ${event.reservationId})`,
        );
      } else {
        this.logger.warn(
          `Failed to send reservation created data to platform (Reservation ID: ${event.reservationId})`,
        );
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
   * 예약이 확정되면 데이터 플랫폼에 확정 데이터를 전송합니다.
   */
  @OnEvent('reservation.confirmed')
  async handleReservationConfirmed(event: ReservationConfirmedEvent) {
    this.logger.log(
      `Handling reservation.confirmed event - Reservation ID: ${event.reservationId}`,
    );

    const payload: DataPlatformPayload = {
      reservationId: event.reservationId,
      userId: event.userId,
      concertId: event.concertId,
      concertScheduleId: event.concertScheduleId,
      seatId: event.seatId,
      timestamp: event.timestamp.toISOString(),
    };

    try {
      const result = await this.dataPlatformApiClient.sendReservationData(
        payload,
      );

      if (result) {
        this.logger.log(
          `Successfully sent reservation confirmed data to platform (Reservation ID: ${event.reservationId})`,
        );
      } else {
        this.logger.warn(
          `Failed to send reservation confirmed data to platform (Reservation ID: ${event.reservationId})`,
        );
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
