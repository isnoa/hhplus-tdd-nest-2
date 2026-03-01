import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { Kafka, Consumer, logLevel, EachMessagePayload } from "kafkajs";

export interface ConsumerConfig {
  groupId: string;
  topic: string;
  fromBeginning?: boolean;
}

export interface MessageHandler {
  (message: any): Promise<void>;
}

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private consumers: Map<string, Consumer> = new Map();
  private logger = new Logger(KafkaConsumerService.name);

  async onModuleInit(): Promise<void> {
    try {
      this.kafka = new Kafka({
        clientId: "concert-reservation-service-consumer",
        brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
        logLevel: logLevel.INFO,
        ssl: process.env.KAFKA_SSL === "true" ? {} : false,
        sasl:
          process.env.KAFKA_SASL_ENABLED === "true"
            ? {
                mechanism: "plain",
                username: process.env.KAFKA_SASL_USERNAME || "admin",
                password: process.env.KAFKA_SASL_PASSWORD || "admin",
              }
            : undefined,
      });

      this.logger.log("Kafka Consumer initialized successfully");
    } catch (error) {
      this.logger.error(
        `Failed to initialize Kafka Consumer: ${error.message}`,
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const consumer of this.consumers.values()) {
      try {
        await consumer.disconnect();
      } catch (error) {
        this.logger.warn(`Failed to disconnect consumer: ${error.message}`);
      }
    }
    this.logger.log("All Kafka Consumers disconnected");
  }

  /**
   * Consumer를 등록하고 메시지 처리를 시작합니다.
   */
  async subscribe(
    config: ConsumerConfig,
    handler: MessageHandler,
  ): Promise<void> {
    if (this.consumers.has(config.groupId)) {
      this.logger.warn(
        `Consumer with groupId '${config.groupId}' already exists`,
      );
      return;
    }

    try {
      const consumer = this.kafka.consumer({
        groupId: config.groupId,
        sessionTimeout: 60000,
        heartbeatInterval: 3000,
        allowAutoTopicCreation: true,
      });

      await consumer.connect();
      this.logger.log(`Consumer '${config.groupId}' connected`);

      await consumer.subscribe({
        topic: config.topic,
        fromBeginning: config.fromBeginning ?? false,
      });

      this.consumers.set(config.groupId, consumer);

      await consumer.run({
        eachMessage: async (payload: EachMessagePayload) => {
          await this.processMessage(payload, handler, config.groupId);
        },
        autoCommit: true,
        autoCommitInterval: 5000,
        autoCommitThreshold: 100,
      });

      this.logger.log(
        `Consumer '${config.groupId}' is listening on topic '${config.topic}'`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to subscribe consumer '${config.groupId}': ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 메시지를 처리합니다.
   */
  private async processMessage(
    payload: EachMessagePayload,
    handler: MessageHandler,
    groupId: string,
  ): Promise<void> {
    const { topic, partition, message } = payload;

    try {
      const messageValue = message.value?.toString("utf-8");
      if (!messageValue) {
        this.logger.warn(`Empty message received from ${topic}:${partition}`);
        return;
      }

      const parsedMessage = JSON.parse(messageValue);

      // 메시지 헤더 로깅
      if (message.headers) {
        const headers = Object.fromEntries(
          Object.entries(message.headers).map(([key, value]) => [
            key,
            value?.toString("utf-8"),
          ]),
        );
        this.logger.debug(`Message headers: ${JSON.stringify(headers)}`);
      }

      // 사용자 정의 핸들러 호출
      await handler(parsedMessage);

      this.logger.debug(
        `Message processed successfully. Topic: ${topic}, Partition: ${partition}, Offset: ${message.offset}`,
      );
    } catch (error) {
      this.logger.error(
        `Error processing message from ${topic}:${partition}. Error: ${error.message}`,
      );

      // 에러 이벤트 발행 (향후 DLQ로 이동)
      this.handleProcessingError(payload, error);

      // Consumer는 계속 실행되어야 함
      // 일반적으로 재시도를 위해 DLQ로 이동
    }
  }

  /**
   * 메시지 처리 에러를 처리합니다.
   */
  private handleProcessingError(payload: EachMessagePayload, error: any): void {
    const { topic, partition, message } = payload;

    // TODO: Dead Letter Queue에 메시지 전송
    // 또는 별도의 에러 저장소에 기록

    this.logger.error(
      `[ERROR HANDLER] Topic: ${topic}, Partition: ${partition}, ` +
        `Offset: ${message.offset}, Error: ${error.message}`,
    );
  }

  /**
   * 특정 Consumer를 중지합니다.
   */
  async stop(groupId: string): Promise<void> {
    const consumer = this.consumers.get(groupId);

    if (!consumer) {
      this.logger.warn(`Consumer '${groupId}' not found`);
      return;
    }

    try {
      await consumer.disconnect();
      this.consumers.delete(groupId);
      this.logger.log(`Consumer '${groupId}' disconnected`);
    } catch (error) {
      this.logger.error(
        `Failed to stop consumer '${groupId}': ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * 모든 Consumer를 중지합니다.
   */
  async stopAll(): Promise<void> {
    for (const [groupId] of this.consumers) {
      await this.stop(groupId);
    }
  }

  /**
   * Consumer 상태를 반환합니다.
   */
  getConsumerStatus(): Map<string, boolean> {
    const status = new Map<string, boolean>();

    for (const [groupId, consumer] of this.consumers) {
      // KafkaJS는 consumer 객체의 상태를 노출하지 않으므로,
      // 여기서는 등록된 consumer의 존재 유무로만 확인
      status.set(groupId, !!consumer);
    }

    return status;
  }

  /**
   * Consumer가 등록되어 있는지 확인합니다.
   */
  hasConsumer(groupId: string): boolean {
    return this.consumers.has(groupId);
  }
}
