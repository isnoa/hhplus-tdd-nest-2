import { IsNumber, IsPositive } from 'class-validator';

export class CreateQueueTokenDto {
  @IsNumber()
  @IsPositive()
  userId: number;
}
