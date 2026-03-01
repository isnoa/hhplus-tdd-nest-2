import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { QueueToken } from "./persistence/queue-token/queue-token.entity";
import { QueueTokenRepository } from "./persistence/queue-token/queue-token.repository.impl";
import { SeatReservationRepository } from "./persistence/seat-reservation/seat-reservation.repository.impl";
import { UserBalanceRepository } from "./persistence/user-balance/user-balance.repository.impl";
import { PaymentRepository } from "./persistence/payment/payment.repository.impl";
import { RedisLockService } from "./persistence/redis-lock.service";
import { PopularityRankingService } from "./persistence/popularity-ranking.service";
import { DataPlatformApiClient } from "./external-api/data-platform.api-client";
import { DataPlatformService } from "./external-api/data-platform.service";
import { KafkaProducerService } from "./external-api/kafka-producer.service";
import { KafkaConsumerService } from "./external-api/kafka-consumer.service";
import { PopularityRankingConsumer } from "./external-api/popularity-ranking.consumer";
import { DataPlatformConsumer } from "./external-api/data-platform.consumer";
import { Seat } from "../concert/entities/seat.entity";
import { User } from "../user/entities/user.entity";
import { Payment } from "../payment/entities/payment.entity";
import { IQueueTokenRepository } from "./domain/repositories/queue-token.repository.interface";
import { ISeatReservationRepository } from "./domain/repositories/seat-reservation.repository.interface";
import { IUserBalanceRepository } from "./domain/repositories/user-balance.repository.interface";
import { IPaymentRepository } from "./domain/repositories/payment.repository.interface";

/**
 * Infrastructure Module
 * 외부 세계와의 모든 연결(DB, 캐시, 외부 API, Kafka 등)을 담당
 */
@Module({
  imports: [TypeOrmModule.forFeature([QueueToken, Seat, User, Payment])],
  providers: [
    {
      provide: "IQueueTokenRepository",
      useClass: QueueTokenRepository,
    },
    {
      provide: "ISeatReservationRepository",
      useClass: SeatReservationRepository,
    },
    {
      provide: "IUserBalanceRepository",
      useClass: UserBalanceRepository,
    },
    {
      provide: "IPaymentRepository",
      useClass: PaymentRepository,
    },
    QueueTokenRepository,
    SeatReservationRepository,
    UserBalanceRepository,
    PaymentRepository,
    // distributed lock service
    RedisLockService,
    // popularity ranking service
    PopularityRankingService,
    // external api services
    DataPlatformApiClient,
    DataPlatformService,
    // Kafka services
    KafkaProducerService,
    KafkaConsumerService,
    // Kafka consumers
    PopularityRankingConsumer,
    DataPlatformConsumer,
  ],
  exports: [
    "IQueueTokenRepository",
    "ISeatReservationRepository",
    "IUserBalanceRepository",
    "IPaymentRepository",
    QueueTokenRepository,
    SeatReservationRepository,
    UserBalanceRepository,
    PaymentRepository,
    RedisLockService,
    PopularityRankingService,
    DataPlatformApiClient,
    DataPlatformService,
    KafkaProducerService,
    KafkaConsumerService,
    PopularityRankingConsumer,
    DataPlatformConsumer,
  ],
})
export class InfrastructureModule {}
