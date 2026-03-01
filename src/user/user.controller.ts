import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { UserService } from "./user.service";
import { ChargePointDto } from "./dto/charge-point.dto";

@ApiTags("Users")
@Controller("users")
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 포인트 잔액 조회
   *
   * @description
   * 사용자의 현재 포인트 잔액을 조회합니다.
   */
  @ApiOperation({
    summary: "포인트 조회",
    description: "사용자 ID로 현재 포인트 잔액을 조회합니다.",
  })
  @ApiParam({
    name: "userId",
    description: "사용자 ID",
    type: "number",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "포인트 조회 성공",
    schema: {
      example: {
        userId: 100,
        point: 50000,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "사용자를 찾을 수 없음",
  })
  @Get(":userId/point")
  getPoint(@Param("userId", ParseIntPipe) userId: number) {
    return this.userService.getPoint(userId);
  }

  /**
   * 포인트 충전
   *
   * @description
   * 사용자의 포인트를 충전합니다.
   * 충전 내역은 POINT_HISTORY 테이블에 기록됩니다.
   */
  @ApiOperation({
    summary: "포인트 충전",
    description: "사용자의 포인트를 충전합니다.",
  })
  @ApiParam({
    name: "userId",
    description: "사용자 ID",
    type: "number",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "포인트 충전 성공",
    schema: {
      example: {
        userId: 100,
        point: 60000,
        chargeAmount: 10000,
        historyId: 1000,
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "잘못된 요청 (충전 금액 오류 등)",
  })
  @ApiResponse({
    status: 404,
    description: "사용자를 찾을 수 없음",
  })
  @Patch(":userId/point/charge")
  chargePoint(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: Omit<ChargePointDto, "userId">,
  ) {
    return this.userService.chargePoint({ userId, amount: body.amount });
  }
}
