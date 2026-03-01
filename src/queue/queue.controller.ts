import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from "@nestjs/swagger";
import { QueueService } from "./queue.service";
import { CreateQueueTokenDto } from "./dto/create-queue-token.dto";

@ApiTags("Queue")
@Controller("queue")
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /**
   * 대기열 토큰 발급
   *
   * @description
   * 사용자에게 대기열 토큰을 발급합니다.
   * 이 토큰을 이용하여 예약/결제 API에 접근할 수 있습니다.
   *
   * 상태: READY (대기 가능) → ACTIVE (활성) → EXPIRED (만료)
   */
  @ApiOperation({
    summary: "대기열 토큰 발급",
    description: "사용자를 대기열에 등록하고 토큰을 발급합니다.",
  })
  @ApiBody({
    type: CreateQueueTokenDto,
    description: "토큰 발급 요청 정보",
  })
  @ApiResponse({
    status: 201,
    description: "토큰 발급 성공",
    schema: {
      example: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        position: 1000,
        estimatedWaitTime: 500,
        status: "READY",
        expiresAt: "2025-02-27T11:00:00Z",
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "잘못된 요청 또는 사용자 ID 누락",
  })
  @Post("token")
  issueToken(@Body() dto: CreateQueueTokenDto) {
    return this.queueService.issueToken(dto);
  }

  /**
   * 대기열 상태 조회
   *
   * @description
   * 발급받은 토큰의 대기열 상태를 조회합니다.
   * 현재 위치와 예상 대기 시간을 반환합니다.
   */
  @ApiOperation({
    summary: "대기열 상태 조회",
    description: "토큰의 현재 대기열 상태와 예상 시간을 조회합니다.",
  })
  @ApiParam({
    name: "token",
    description: "대기열 토큰",
    type: "string",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @ApiResponse({
    status: 200,
    description: "상태 조회 성공",
    schema: {
      example: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        position: 500,
        estimatedWaitTime: 250,
        status: "READY",
        expiresAt: "2025-02-27T11:00:00Z",
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "토큰을 찾을 수 없음",
  })
  @Get("token/:token/status")
  getQueueStatus(@Param("token") token: string) {
    return this.queueService.getQueueStatus(token);
  }
}
