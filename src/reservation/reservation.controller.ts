import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ReservationService } from './reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { QueueTokenGuard } from '../common/guards/queue-token.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('reservations')
@UseGuards(QueueTokenGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /** 좌석 예약 요청 */
  @Post()
  createReservation(
    @CurrentUserId() userId: number,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationService.createReservation(userId, dto);
  }

  /** 예약 조회 */
  @Get(':reservationId')
  getReservation(@Param('reservationId', ParseIntPipe) reservationId: number) {
    return this.reservationService.getReservation(reservationId);
  }
}
