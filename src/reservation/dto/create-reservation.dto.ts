import { IsNumber, IsPositive } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateReservationDto {
  @ApiProperty({
    description: "콘서트 일정 ID",
    type: "number",
    example: 10,
  })
  @IsNumber()
  @IsPositive()
  concertScheduleId: number;

  @ApiProperty({
    description: "좌석 번호 (1부터 시작)",
    type: "number",
    example: 25,
  })
  @IsNumber()
  @IsPositive()
  seatNumber: number;
}
