import { IsNumber, IsPositive } from 'class-validator';

export class CreateReservationDto {
  @IsNumber()
  @IsPositive()
  concertScheduleId: number;

  @IsNumber()
  @IsPositive()
  seatNumber: number;
}
