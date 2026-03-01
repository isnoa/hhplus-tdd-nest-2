import { IsNumber, IsPositive } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ChargePointDto {
  @ApiProperty({
    description: "사용자 ID",
    type: "number",
    example: 100,
  })
  @IsNumber()
  @IsPositive()
  userId: number;

  @ApiProperty({
    description: "충전 금액",
    type: "number",
    example: 10000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
