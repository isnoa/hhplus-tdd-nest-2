import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { PaymentService } from "./payment.service";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { QueueTokenGuard } from "../common/guards/queue-token.guard";
import { CurrentUserId } from "../common/decorators/current-user-id.decorator";

@ApiTags("Payments")
@ApiBearerAuth("bearer")
@Controller("payments")
@UseGuards(QueueTokenGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 결제 처리
   *
   * @description
   * 사용자의 포인트를 차감하여 예약을 결제합니다.
   * 클린 아키텍처 기반으로 구현되어 복잡한 비즈니스 로직을 격리합니다.
   *
   * 프로세스:
   * 1. 예약 상태 확인
   * 2. 스케줄 정보 조회
   * 3. 사용자 포인트 차감
   * 4. 결제 처리
   * 5. 이벤트 발행
   * 6. 대기열 토큰 만료
   */
  @ApiOperation({
    summary: "결제 처리",
    description: "예약을 결제하고 포인트를 차감합니다.",
  })
  @ApiHeader({
    name: "x-queue-token",
    description: "대기열 토큰 (QueueTokenGuard에서 검증)",
    required: true,
  })
  @ApiBody({
    type: CreatePaymentDto,
    description: "결제 요청 정보",
  })
  @ApiResponse({
    status: 201,
    description: "결제 성공",
    schema: {
      example: {
        id: 1,
        userId: 100,
        reservationId: 50,
        amount: 10000,
        status: "COMPLETED",
        createdAt: "2025-02-27T10:30:00Z",
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "잘못된 요청 (포인트 부족, 예약 상태 오류 등)",
    schema: {
      example: {
        statusCode: 400,
        message: "Insufficient points",
        error: "Bad Request",
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "인증 실패 (토큰 없음 또는 만료)",
    schema: {
      example: {
        statusCode: 401,
        message: "Unauthorized",
        error: "Invalid queue token",
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "예약을 찾을 수 없음",
    schema: {
      example: {
        statusCode: 404,
        message: "Reservation not found",
        error: "Not Found",
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: "서버 오류 (결제 게이트웨이 실패 등)",
    schema: {
      example: {
        statusCode: 500,
        message: "Payment gateway error",
        error: "Internal Server Error",
      },
    },
  })
  @Post()
  async processPayment(
    @CurrentUserId() userId: number,
    @Request() req: any,
    @Body() dto: CreatePaymentDto,
  ) {
    const queueToken: string = req.headers["x-queue-token"];
    return this.paymentService.processPayment(userId, queueToken, dto);
  }

  /**
   * 결제 내역 조회
   *
   * @description
   * 특정 결제 내역의 상세 정보를 조회합니다.
   */
  @ApiOperation({
    summary: "결제 내역 조회",
    description: "결제 ID로 결제 상세 정보를 조회합니다.",
  })
  @ApiParam({
    name: "id",
    description: "결제 ID",
    type: "number",
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "결제 조회 성공",
    schema: {
      example: {
        id: 1,
        userId: 100,
        reservationId: 50,
        amount: 10000,
        status: "COMPLETED",
        createdAt: "2025-02-27T10:30:00Z",
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "결제를 찾을 수 없음",
  })
  @Get(":id")
  async getPayment(@Param("id") id: number) {
    return this.paymentService.getPayment(id);
  }
}
