import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ConcertService } from "./concert.service";
import { QueueTokenGuard } from "../common/guards/queue-token.guard";

@ApiTags("Concerts")
@ApiBearerAuth("bearer")
@Controller("concerts")
@UseGuards(QueueTokenGuard)
export class ConcertController {
  constructor(private readonly concertService: ConcertService) {}

  /**
   * 예약 가능 날짜 조회
   *
   * @description
   * 특정 콘서트의 예약 가능한 날짜 목록을 조회합니다.
   */
  @ApiOperation({
    summary: "예약 가능 날짜 조회",
    description: "콘서트의 모든 예약 가능한 날짜를 조회합니다.",
  })
  @ApiParam({
    name: "concertId",
    description: "콘서트 ID",
    type: "number",
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "날짜 조회 성공",
    schema: {
      example: {
        concertId: 1,
        schedules: [
          {
            id: 10,
            date: "2025-03-15",
            time: "19:00",
            venue: "올림픽 체조경기장",
            price: 50000,
            availableSeats: 450,
            totalSeats: 500,
          },
          {
            id: 11,
            date: "2025-03-16",
            time: "15:00",
            venue: "올림픽 체조경기장",
            price: 50000,
            availableSeats: 420,
            totalSeats: 500,
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "콘서트를 찾을 수 없음",
  })
  @Get(":concertId/available-dates")
  getAvailableDates(@Param("concertId", ParseIntPipe) concertId: number) {
    return this.concertService.getAvailableDates(concertId);
  }

  /**
   * 예약 가능 좌석 조회
   *
   * @description
   * 특정 일정의 예약 가능한 좌석 목록을 조회합니다.
   * 좌석 상태: AVAILABLE(예약 가능), RESERVED(예약됨), TEMP_RESERVED(임시 예약)
   */
  @ApiOperation({
    summary: "예약 가능 좌석 조회",
    description: "일정별 예약 가능한 좌석 목록을 조회합니다.",
  })
  @ApiParam({
    name: "scheduleId",
    description: "콘서트 일정 ID",
    type: "number",
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "좌석 조회 성공",
    schema: {
      example: {
        scheduleId: 10,
        concert: "아이유 콘서트",
        date: "2025-03-15",
        time: "19:00",
        seats: [
          {
            id: 1,
            number: 1,
            status: "AVAILABLE",
            price: 50000,
            grade: "R",
          },
          {
            id: 2,
            number: 2,
            status: "AVAILABLE",
            price: 50000,
            grade: "R",
          },
          {
            id: 3,
            number: 3,
            status: "TEMP_RESERVED",
            price: 50000,
            grade: "R",
          },
          {
            id: 4,
            number: 4,
            status: "RESERVED",
            price: 50000,
            grade: "R",
          },
        ],
        statistics: {
          total: 500,
          available: 450,
          reserved: 40,
          tempReserved: 10,
        },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "일정을 찾을 수 없음",
  })
  @Get("schedules/:scheduleId/seats")
  getAvailableSeats(@Param("scheduleId", ParseIntPipe) scheduleId: number) {
    return this.concertService.getAvailableSeats(scheduleId);
  }
}
