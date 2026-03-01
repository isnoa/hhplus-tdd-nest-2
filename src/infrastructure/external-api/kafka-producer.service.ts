import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Kafka, Producer, logLevel } from "kafkajs";

export interface KafkaMessage {
  key: string;
  value: string;
  headers?: Record<string, string>;
}

@Injectable()
export class KafkaProducerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private logger = new Logger(KafkaProducerService.name);

  async onModuleInit(): Promise<void> {
    try {
      this.kafka = new Kafka({
        clientId: "concert-reservation-service",
        brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
        logLevel: logLevel.INFO,
        ssl: process.env.KAFKA_SSL === "true" ? {} : false,
        sasl:
          process.env.KAFKA_SASL_ENABLED === "true"
            ? {
                mechanism: "plain",
                username: process.env.KAFKA_SASL_USERNAME,
                password: process.env.KAFKA_SASL_PASSWORD,
              }
            : undefined,
      });

      this.producer = this.kafka.producer({
        idempotent: true,
        transactionTimeout: 60000,
        maxInFlightRequests: 5,
      });

      await this.producer.connect();
      this.logger.log("Kafka Producer connected successfully");
    } catch (error) {
      this.logger.error(`Failed to connect Kafka Producer: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
      this.logger.log("Kafka Producer disconnected");
    }
  }

  /**
   * 콘서트 예약 이벤트를 발행합니다.
   * @param topic 토픽명 (기본값: concert-reservations)
   * @param messages 메시지 배열
   */
  async sendMessage(
    topic: string = "concert-reservations",
    messages: KafkaMessage[],
  ): Promise<void> {
    try {
      const kafkaMessages = messages.map((msg) => ({
        key: msg.key,
        value: msg.value,
        headers: msg.headers || {},
        timestamp: Date.now().toString(),
      }));

      const result = await this.producer.send({
        topic,
        messages: kafkaMessages,
        timeout: 30000,
        compression: 1, // Gzip 압축
      });

      this.logger.debug(
        `Message sent successfully. Topic: ${topic}, Partitions: ${JSON.stringify(result)}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send message to Kafka. Topic: ${topic}, Error: ${error.message}`,
      );

      if (this.isRetryableError(error)) {
        this.logger.warn(`Retryable error detected. Will attempt to resend.`);
      }

      throw error;
    }
  }

  /**
   * 예약 생성 이벤트를 발행합니다.
   */
  async publishReservationCreatedEvent(event: any): Promise<void> {
    const message: KafkaMessage = {
      key: event.concertId.toString(),
      value: JSON.stringify({
        eventType: "reservation.created",
        eventId: this.generateEventId(),
        eventTimestamp: new Date().toISOString(),
        ...event,
      }),
      headers: {
        schema_version: "1.0",
        event_type: "reservation.created",
      },
    };

    await this.sendMessage("concert-reservations", [message]);
  }

  /**
   * 예약 확인 이벤트를 발행합니다.
   */
  async publishReservationConfirmedEvent(event: any): Promise<void> {
    const message: KafkaMessage = {
      key: event.concertId.toString(),
      value: JSON.stringify({
        eventType: "reservation.confirmed",
        eventId: this.generateEventId(),
        eventTimestamp: new Date().toISOString(),
        ...event,
      }),
      headers: {
        schema_version: "1.0",
        event_type: "reservation.confirmed",
      },
    };

    await this.sendMessage("concert-reservations", [message]);
  }

  /**
   * 예약 취소 이벤트를 발행합니다.
   */
  async publishReservationCancelledEvent(event: any): Promise<void> {
    const message: KafkaMessage = {
      key: event.concertId.toString(),
      value: JSON.stringify({
        eventType: "reservation.cancelled",
        eventId: this.generateEventId(),
        eventTimestamp: new Date().toISOString(),
        ...event,
      }),
      headers: {
        schema_version: "1.0",
        event_type: "reservation.cancelled",
      },
    };

    await this.sendMessage("concert-reservations", [message]);
  }

  /**
   * 배치 메시지 발행 (성능 최적화)
   */
  async publishBatch(topic: string, events: any[]): Promise<void> {
    const messages: KafkaMessage[] = events.map((event) => ({
      key: event.concertId.toString(),
      value: JSON.stringify({
        eventId: this.generateEventId(),
        eventTimestamp: new Date().toISOString(),
        ...event,
      }),
      headers: {
        schema_version: "1.0",
      },
    }));

    await this.sendMessage(topic, messages);
  }

  /**
   * 트랜잭션을 통한 메시지 발행 (원자성 보장)
   */
  async publishWithTransaction(
    topic: string,
    messages: KafkaMessage[],
  ): Promise<void> {
    const transaction = await this.producer.transaction();

    try {
      const kafkaMessages = messages.map((msg) => ({
        key: msg.key,
        value: msg.value,
        headers: msg.headers || {},
      }));

      await transaction.send({
        topic,
        messages: kafkaMessages,
      });

      await transaction.commit();
      this.logger.debug(`Transaction committed successfully`);
    } catch (error) {
      await transaction.abort();
      this.logger.error(`Transaction aborted due to error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Producer 상태 확인
   */
  isConnected(): boolean {
    return this.producer !== undefined;
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  private isRetryableError(error: any): boolean {
    const retryableErrors = ["NETWORK_EXCEPTION", "REQUEST_TIMED_OUT"];
    return retryableErrors.includes(error.name);
  }

  /**
   * UUID 생성 (간단한 방식)
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
