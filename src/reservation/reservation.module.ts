import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ScheduleModule } from "@nestjs/schedule";
import { Reservation } from "./entities/reservation.entity";
import { ReservationService } from "./reservation.service";
import { ReservationController } from "./reservation.controller";
import { QueueModule } from "../queue/queue.module";
import { ConcertModule } from "../concert/concert.module";
import { Seat } from "../concert/entities/seat.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation, Seat]),
    ScheduleModule.forRoot(),
    QueueModule,
    ConcertModule,
  ],
  controllers: [ReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}
