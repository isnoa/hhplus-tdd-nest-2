import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { DataPlatformApiClient } from "./data-platform.api-client";
import { KafkaConsumerService } from "./kafka-consumer.service";

/**
 * DataPlatformConsumer
 *
 * Kafka의 concert-reservations 토픽에서 예약 이벤트를 수신하여
 * 데이터 플랫폼 API로 전송합니다.
 *
 * Consumer Group: "data-platform-consumer"
 * 목적: 예약 정보를 외부 데이터 플랫폼으로 동기화
 * 특징: 배치 처리로 성능 최적화
 */
@Injectable()
export class DataPlatformConsumer implements OnModuleInit {
  private logger = new Logger(DataPlatformConsumer.name);
  private isStarted = false;
  private messageBuffer: any[] = [];
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_TIMEOUT_MS = 5000;
  private batchTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly kafkaConsumerService: KafkaConsumerService,
    private readonly dataPlatformApiClient: DataPlatformApiClient,
  ) {}

  async onModuleInit(): Promise<void> {
    // 환경 변수 확인
    if (!this.isConsumerEnabled()) {
      this.logger.log(
        "DataPlatformConsumer is disabled (USE_DATA_PLATFORM_CONSUMER=false)",
      );
      return;
    }

    try {
      await this.startConsumer();
    } catch (error) {
      this.logger.error(
        `Failed to start DataPlatformConsumer: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Consumer 시작
   */
  private async startConsumer(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn("DataPlatformConsumer is already started");
      return;
    }

    try {
      await this.kafkaConsumerService.subscribe(
        {
          groupId: "data-platform-consumer",
          topic: "concert-reservations",
          fromBeginning: false,
        },
        this.handleMessage.bind(this),
      );

      this.isStarted = true;
      this.logger.log(
        "DataPlatformConsumer started successfully on topic: concert-reservations",
      );
    } catch (error) {
      this.logger.error(
        `Failed to start DataPlatformConsumer: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 메시지 처리 (배치 처리)
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      // 메시지를 버퍼에 추가
      this.messageBuffer.push({
        eventType: message.eventType,
        reservationId: message.reservationId,
        userId: message.userId,
        concertId: message.concertId,
        concertScheduleId: message.concertScheduleId,
        seatId: message.seatId,
        timestamp: message.timestamp,
      });

      this.logger.debug(
        `Message buffered. Buffer size: ${this.messageBuffer.length}`,
      );

      // 배치 크기에 도달하면 즉시 전송
      if (this.messageBuffer.length >= this.BATCH_SIZE) {
        await this.flushBatch();
      } else if (this.messageBuffer.length === 1) {
        // 첫 메시지 도착 시 타이머 시작
        this.startBatchTimer();
      }
    } catch (error) {
      this.logger.error(
        `Error handling message in DataPlatformConsumer: ${error.message}`,
        error.stack,
      );
      // Consumer는 계속 실행
    }
  }

  /**
   * 배치 타이머 시작
   */
  private startBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      if (this.messageBuffer.length > 0) {
        this.flushBatch().catch((error) => {
          this.logger.error(
            `Error flushing batch on timeout: ${error.message}`,
          );
        });
      }
    }, this.BATCH_TIMEOUT_MS);
  }

  /**
   * 배치 전송
   */
  private async flushBatch(): Promise<void> {
    if (this.messageBuffer.length === 0) {
      return;
    }

    const batch = [...this.messageBuffer];
    this.messageBuffer = [];

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    try {
      this.logger.log(
        `Sending batch to data platform. Batch size: ${batch.length}`,
      );

      // 배치 전송
      const result = await this.dataPlatformApiClient.sendReservationDataBatch(
        batch.map((msg) => ({
          reservationId: msg.reservationId,
          userId: msg.userId,
          concertId: msg.concertId,
          concertScheduleId: msg.concertScheduleId,
          seatId: msg.seatId,
          timestamp: msg.timestamp,
        })),
      );

      if (result) {
        this.logger.log(
          `Successfully sent batch to data platform (${batch.length} messages)`,
        );
      } else {
        this.logger.warn(
          `Failed to send batch to data platform. Will retry on next flush.`,
        );
        // 재전송을 위해 버퍼로 되돌림 (또는 DLQ로 이동)
        this.messageBuffer = [...batch, ...this.messageBuffer];
      }
    } catch (error) {
      this.logger.error(`Error flushing batch: ${error.message}`, error.stack);
      // 재전송을 위해 버퍼로 되돌림
      this.messageBuffer = [...batch, ...this.messageBuffer];
    }
  }

  /**
   * Consumer 활성화 여부 확인
   */
  private isConsumerEnabled(): boolean {
    const enabled = process.env.USE_DATA_PLATFORM_CONSUMER;
    return enabled === "true" || enabled === "1";
  }

  /**
   * Consumer 중지
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.warn("DataPlatformConsumer is not started");
      return;
    }

    try {
      // 남은 메시지 전송
      if (this.messageBuffer.length > 0) {
        await this.flushBatch();
      }

      // 타이머 정리
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
      }

      await this.kafkaConsumerService.stop("data-platform-consumer");
      this.isStarted = false;
      this.logger.log("DataPlatformConsumer stopped");
    } catch (error) {
      this.logger.error(
        `Error stopping DataPlatformConsumer: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Consumer 상태 확인
   */
  isRunning(): boolean {
    return this.isStarted;
  }

  /**
   * 버퍼 상태 확인
   */
  getBufferStatus(): { size: number; capacity: number } {
    return {
      size: this.messageBuffer.length,
      capacity: this.BATCH_SIZE,
    };
  }
}
