import { IsNumber, IsPositive } from 'class-validator';

export class ChargePointDto {
  @IsNumber()
  @IsPositive()
  userId: number;

  @IsNumber()
  @IsPositive()
  amount: number;
}
