import { IsNumber, IsPositive } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreatePaymentDto {
  @ApiProperty({
    description: "예약 ID",
    type: "number",
    example: 50,
  })
  @IsNumber()
  @IsPositive()
  reservationId: number;
}
