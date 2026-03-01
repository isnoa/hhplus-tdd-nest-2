import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { DatabaseModule } from "./database/database.module";
import { UserModule } from "./user/user.module";
import { QueueModule } from "./queue/queue.module";
import { ConcertModule } from "./concert/concert.module";
import { ReservationModule } from "./reservation/reservation.module";
import { PaymentModule } from "./payment/payment.module";
import { InfrastructureModule } from "./infrastructure/infrastructure.module";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    DatabaseModule,
    InfrastructureModule,
    UserModule,
    QueueModule,
    ConcertModule,
    ReservationModule,
    PaymentModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
