import { Injectable, Logger } from '@nestjs/common';

export interface DataPlatformPayload {
  reservationId: number;
  userId: number;
  concertId: number;
  concertScheduleId: number;
  seatId: number;
  timestamp: string;
}

/**
 * Mock API Client for Data Platform
 * 실제 환경에서는 HttpModule을 사용하여 외부 API에 연결
 */
@Injectable()
export class DataPlatformApiClient {
  private readonly logger = new Logger(DataPlatformApiClient.name);
  private readonly apiBaseUrl = process.env.DATA_PLATFORM_API_URL || 'https://data-platform.api/v1';

  /**
   * 예약 정보를 데이터 플랫폼에 전송
   * 
   * @param payload 예약 정보
   * @returns 성공 여부
   */
  async sendReservationData(payload: DataPlatformPayload): Promise<boolean> {
    try {
      this.logger.log(
        `Sending reservation data to data platform: ${JSON.stringify(payload)}`,
      );

      // Mock API 호출 (실제 환경에서는 HttpClient.post() 사용)
      const response = await this.mockApiCall(payload);

      if (response.success) {
        this.logger.log(
          `Successfully sent reservation data (ID: ${payload.reservationId})`,
        );
        return true;
      } else {
        this.logger.warn(
          `Failed to send reservation data: ${response.error}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Error sending reservation data to data platform: ${error.message}`,
        error.stack,
      );
      // 데이터 플랫폼 연동 실패는 예약 자체를 실패시키지 않음
      return false;
    }
  }

  /**
   * Mock API Call (실제 환경에서는 HttpClient.post() 사용)
   * 
   * @param payload 예약 정보
   * @returns Mock 응답
   */
  private async mockApiCall(payload: DataPlatformPayload): Promise<{
    success: boolean;
    error?: string;
  }> {
    // 비동기 처리 시뮬레이션
    return new Promise((resolve) => {
      // 실제 API 호출 지연 시뮬레이션 (100ms)
      setTimeout(() => {
        // Mock: 90% 성공율
        const isSuccess = Math.random() < 0.9;

        resolve({
          success: isSuccess,
          error: isSuccess ? undefined : 'Platform service unavailable',
        });
      }, 100);
    });
  }

  /**
   * 배치 데이터 전송 (추후 구현)
   */
  async sendReservationDataBatch(payloads: DataPlatformPayload[]): Promise<{
    succeeded: number;
    failed: number;
  }> {
    this.logger.log(`Sending batch of ${payloads.length} records to data platform`);

    let succeeded = 0;
    let failed = 0;

    for (const payload of payloads) {
      const result = await this.sendReservationData(payload);
      if (result) {
        succeeded++;
      } else {
        failed++;
      }
    }

    this.logger.log(
      `Batch send completed - Succeeded: ${succeeded}, Failed: ${failed}`,
    );

    return { succeeded, failed };
  }
}
