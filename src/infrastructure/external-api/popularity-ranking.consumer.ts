import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { PopularityRankingService } from "../persistence/popularity-ranking.service";
import { KafkaConsumerService } from "./kafka-consumer.service";

/**
 * PopularityRankingConsumer
 *
 * Kafka의 concert-reservations 토픽에서 예약 이벤트를 수신하여
 * Redis Sorted Set의 인기도 랭킹을 실시간으로 업데이트합니다.
 *
 * Consumer Group: "popularity-ranking-group"
 * 목적: 각 콘서트의 예약 수와 매진지수를 추적
 */
@Injectable()
export class PopularityRankingConsumer implements OnModuleInit {
  private logger = new Logger(PopularityRankingConsumer.name);
  private isStarted = false;

  constructor(
    private readonly kafkaConsumerService: KafkaConsumerService,
    private readonly popularityRankingService: PopularityRankingService,
  ) {}

  async onModuleInit(): Promise<void> {
    // 환경 변수 확인
    if (!this.isConsumerEnabled()) {
      this.logger.log(
        "PopularityRankingConsumer is disabled (USE_POPULARITY_CONSUMER=false)",
      );
      return;
    }

    try {
      await this.startConsumer();
    } catch (error) {
      this.logger.error(
        `Failed to start PopularityRankingConsumer: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Consumer 시작
   */
  private async startConsumer(): Promise<void> {
    if (this.isStarted) {
      this.logger.warn("PopularityRankingConsumer is already started");
      return;
    }

    try {
      await this.kafkaConsumerService.subscribe(
        {
          groupId: "popularity-ranking-group",
          topic: "concert-reservations",
          fromBeginning: false,
        },
        this.handleMessage.bind(this),
      );

      this.isStarted = true;
      this.logger.log(
        "PopularityRankingConsumer started successfully on topic: concert-reservations",
      );
    } catch (error) {
      this.logger.error(
        `Failed to start PopularityRankingConsumer: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 메시지 처리
   */
  private async handleMessage(message: any): Promise<void> {
    try {
      const eventType = message.eventType;

      this.logger.debug(
        `Processing event: ${eventType} for Concert ID: ${message.concertId}`,
      );

      // 예약 생성 이벤트: 콘서트의 예약 수 증가
      if (eventType === "reservation.created") {
        await this.popularityRankingService.recordReservation(
          message.concertId,
          message.concertScheduleId,
        );

        this.logger.debug(
          `Recorded reservation for Concert ID: ${message.concertId}`,
        );
      }

      // 예약 확인 이벤트: 확정된 예약으로 처리
      if (eventType === "reservation.confirmed") {
        // 필요시 추가 로직 (예: 별도의 확정 카운트)
        this.logger.debug(
          `Confirmed reservation for Concert ID: ${message.concertId}`,
        );
      }

      // 예약 취소 이벤트
      if (eventType === "reservation.cancelled") {
        // 필요시 예약 수 감소 로직
        this.logger.debug(
          `Cancelled reservation for Concert ID: ${message.concertId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error handling message in PopularityRankingConsumer: ${error.message}`,
        error.stack,
      );
      // Consumer는 계속 실행 (일부 이벤트 처리 실패가 전체 시스템을 중단시키지 않음)
    }
  }

  /**
   * Consumer 활성화 여부 확인
   */
  private isConsumerEnabled(): boolean {
    const enabled = process.env.USE_POPULARITY_CONSUMER;
    return enabled === "true" || enabled === "1";
  }

  /**
   * Consumer 중지
   */
  async stop(): Promise<void> {
    if (!this.isStarted) {
      this.logger.warn("PopularityRankingConsumer is not started");
      return;
    }

    try {
      await this.kafkaConsumerService.stop("popularity-ranking-group");
      this.isStarted = false;
      this.logger.log("PopularityRankingConsumer stopped");
    } catch (error) {
      this.logger.error(
        `Error stopping PopularityRankingConsumer: ${error.message}`,
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
}
