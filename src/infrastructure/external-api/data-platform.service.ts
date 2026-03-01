import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReservationConfirmedEvent } from '../../reservation/events/reservation-confirmed.event';
import { DataPlatformApiClient } from './data-platform.api-client';

/**
 * Data Platform Service
 * 
 * 예약 확인 이벤트를 수신하여 데이터 플랫폼으로 데이터를 전송합니다.
 * 이를 통해 트랜잭션 처리와 외부 API 호출을 분리합니다.
 */
@Injectable()
export class DataPlatformService {
  private readonly logger = new Logger(DataPlatformService.name);

  constructor(private readonly apiClient: DataPlatformApiClient) {}

  /**
   * 예약 확인 이벤트 리스너
   * 
   * ReservationService에서 예약이 확인되면 이 메서드가 비동기로 호출됩니다.
   * 데이터 플랫폼으로 예약 정보를 전송합니다.
   */
  @OnEvent('reservation.confirmed', { async: true })
  async handleReservationConfirmed(event: ReservationConfirmedEvent) {
    this.logger.log(
      `Handling reservation confirmed event: ${event.reservationId}`,
    );

    const payload = {
      reservationId: event.reservationId,
      userId: event.userId,
      concertId: event.concertId,
      concertScheduleId: event.concertScheduleId,
      seatId: event.seatId,
      timestamp: event.timestamp.toISOString(),
    };

    const result = await this.apiClient.sendReservationData(payload);

    if (result) {
      this.logger.log(
        `Reservation ${event.reservationId} successfully sent to data platform`,
      );
    } else {
      this.logger.warn(
        `Failed to send reservation ${event.reservationId} to data platform`,
      );
      // 실패해도 예약 시스템에 영향을 주지 않음
    }
  }

  /**
   * 데이터 플랫폼 상태 확인 (헬스 체크)
   */
  async checkHealth(): Promise<boolean> {
    try {
      // 실제 구현 시 헬스체크 엔드포인트 호출
      this.logger.log('Data platform health check');
      return true;
    } catch (error) {
      this.logger.error('Data platform health check failed:', error);
      return false;
    }
  }
}
