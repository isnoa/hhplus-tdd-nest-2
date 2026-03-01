import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Concert } from './entities/concert.entity';
import { ConcertSchedule } from './entities/concert-schedule.entity';
import { Seat } from './entities/seat.entity';
import { ConcertService } from './concert.service';
import { ConcertController } from './concert.controller';
import { QueueModule } from '../queue/queue.module';
import { InfrastructureModule } from '../infrastructure/infrastructure.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Concert, ConcertSchedule, Seat]),
    QueueModule,
    InfrastructureModule,
  ],
  controllers: [ConcertController],
  providers: [ConcertService],
  exports: [ConcertService, TypeOrmModule],
})
export class ConcertModule {}
