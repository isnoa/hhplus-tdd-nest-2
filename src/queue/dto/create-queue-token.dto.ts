import { IsNumber, IsPositive } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateQueueTokenDto {
  @ApiProperty({
    description: "사용자 ID",
    type: "number",
    example: 100,
  })
  @IsNumber()
  @IsPositive()
  userId: number;
}
