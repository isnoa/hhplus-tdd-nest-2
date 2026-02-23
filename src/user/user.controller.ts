import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { UserService } from './user.service';
import { ChargePointDto } from './dto/charge-point.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** 포인트 조회 */
  @Get(':userId/point')
  getPoint(@Param('userId', ParseIntPipe) userId: number) {
    return this.userService.getPoint(userId);
  }

  /** 포인트 충전 */
  @Patch(':userId/point/charge')
  chargePoint(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: Omit<ChargePointDto, 'userId'>,
  ) {
    return this.userService.chargePoint({ userId, amount: body.amount });
  }
}
