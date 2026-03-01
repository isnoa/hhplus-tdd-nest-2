import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { ReservationService } from "./reservation.service";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { QueueTokenGuard } from "../common/guards/queue-token.guard";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator";

@ApiTags("Reservations")
@ApiBearerAuth("bearer")
@Controller("reservations")
@UseGuards(QueueTokenGuard)
export class ReservationController {
  constructor(private readonly reservationService: ReservationService) {}

  /**
   * 좌석 예약
   *
   * @description
   * 콘서트 일정의 특정 좌석을 예약합니다.
   * Pessimistic Write Lock을 이용하여 동시성을 제어합니다.
   *
   * 상태: TEMPORARY (임시 예약) → CONFIRMED (확정)
   */
  @ApiOperation({
    summary: "좌석 예약",
    description: "선택한 좌석을 임시로 예약합니다. 결제 완료 시 확정됩니다.",
  })
  @ApiBody({
    type: CreateReservationDto,
    description: "예약 요청 정보",
  })
  @ApiResponse({
    status: 201,
    description: "예약 생성 성공",
    schema: {
      example: {
        id: 50,
        userId: 100,
        seatId: 25,
        scheduleId: 10,
        status: "TEMPORARY",
        tempReservedUntil: "2025-02-27T11:00:00Z",
        createdAt: "2025-02-27T10:30:00Z",
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "잘못된 요청 또는 좌석 이미 예약됨",
    schema: {
      example: {
        statusCode: 400,
        message: "Seat already reserved",
        error: "Bad Request",
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "인증 실패",
  })
  @ApiResponse({
    status: 404,
    description: "좌석 또는 일정을 찾을 수 없음",
  })
  @ApiResponse({
    status: 409,
    description: "동시성 충돌 (다른 사용자가 같은 좌석 예약 중)",
  })
  @Post()
  createReservation(
    @CurrentUserId() userId: number,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationService.createReservation(userId, dto);
  }

  /**
   * 예약 상세 조회
   *
   * @description
   * 예약 ID로 예약 상세 정보를 조회합니다.
   */
  @ApiOperation({
    summary: "예약 조회",
    description: "예약 ID로 예약 상세 정보를 조회합니다.",
  })
  @ApiParam({
    name: "reservationId",
    description: "예약 ID",
    type: "number",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "예약 조회 성공",
    schema: {
      example: {
        id: 50,
        userId: 100,
        seatId: 25,
        scheduleId: 10,
        status: "TEMPORARY",
        tempReservedUntil: "2025-02-27T11:00:00Z",
        createdAt: "2025-02-27T10:30:00Z",
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "예약을 찾을 수 없음",
  })
  @Get(":reservationId")
  getReservation(@Param("reservationId", ParseIntPipe) reservationId: number) {
    return this.reservationService.getReservation(reservationId);
  }
}
