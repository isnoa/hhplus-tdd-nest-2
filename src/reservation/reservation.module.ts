import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Reservation } from './entities/reservation.entity';
import { ReservationService } from './reservation.service';
import { ReservationController } from './reservation.controller';
import { QueueModule } from '../queue/queue.module';
import { ConcertModule } from '../concert/concert.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reservation]),
    QueueModule,
    ConcertModule,
  ],
  controllers: [ReservationController],
  providers: [ReservationService],
  exports: [ReservationService],
})
export class ReservationModule {}
