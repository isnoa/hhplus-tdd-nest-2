import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ConcertService } from './concert.service';
import { QueueTokenGuard } from '../common/guards/queue-token.guard';

@Controller('concerts')
@UseGuards(QueueTokenGuard)
export class ConcertController {
  constructor(private readonly concertService: ConcertService) {}

  /** 예약 가능 날짜 조회 */
  @Get(':concertId/available-dates')
  getAvailableDates(@Param('concertId', ParseIntPipe) concertId: number) {
    return this.concertService.getAvailableDates(concertId);
  }

  /** 예약 가능 좌석 조회 */
  @Get('schedules/:scheduleId/seats')
  getAvailableSeats(@Param('scheduleId', ParseIntPipe) scheduleId: number) {
    return this.concertService.getAvailableSeats(scheduleId);
  }
}
