import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ConcertService } from "./concert.service";
import { PopularityRankingService } from "../infrastructure/persistence/popularity-ranking.service";
import { QueueTokenGuard } from "../common/guards/queue-token.guard";
import {
  PopularityRankingsListDto,
  PopularityRankingsResponseDto,
} from "./dto/popularity-rankings.dto";

@ApiTags("Concerts")
@ApiBearerAuth("bearer")
@Controller("concerts")
@UseGuards(QueueTokenGuard)
export class ConcertController {
  constructor(
    private readonly concertService: ConcertService,
    private readonly popularityRankingService: PopularityRankingService,
  ) {}

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

  /**
   * 실시간 인기도 순위 조회
   *
   * @description
   * 현재 시점의 콘서트 인기도 실시간 순위를 조회합니다.
   * 점수 계산: (예약 수 × 0.7) + (매진율 × 100 × 0.3)
   */
  @ApiOperation({
    summary: "실시간 인기도 순위",
    description: "실시간 콘서트 인기도 순위 (Top 10)",
  })
  @ApiQuery({
    name: "limit",
    description: "조회할 순위 개수",
    type: "number",
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "실시간 순위 조회 성공",
  })
  @Get("rankings/realtime")
  async getRealTimeRanking(
    @Query("limit") limit?: string,
  ): Promise<PopularityRankingsListDto> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const rankings =
      await this.popularityRankingService.getRealTimeRanking(limitNum);
    return {
      rankings: rankings as PopularityRankingsResponseDto[],
      type: "realtime",
      timestamp: new Date(),
    };
  }

  /**
   * 시간별 인기도 순위 조회
   *
   * @description
   * 현재 시간의 콘서트 인기도 순위를 조회합니다.
   */
  @ApiOperation({
    summary: "시간별 인기도 순위",
    description: "현재 시간의 콘서트 인기도 순위",
  })
  @ApiQuery({
    name: "limit",
    description: "조회할 순위 개수",
    type: "number",
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "시간별 순위 조회 성공",
  })
  @Get("rankings/hourly")
  async getHourlyRanking(
    @Query("limit") limit?: string,
  ): Promise<PopularityRankingsListDto> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const rankings =
      await this.popularityRankingService.getHourlyRanking(limitNum);
    return {
      rankings: rankings as PopularityRankingsResponseDto[],
      type: "hourly",
      timestamp: new Date(),
    };
  }

  /**
   * 일일 인기도 순위 조회
   *
   * @description
   * 오늘의 콘서트 인기도 순위를 조회합니다.
   */
  @ApiOperation({
    summary: "일일 인기도 순위",
    description: "오늘의 콘서트 인기도 순위",
  })
  @ApiQuery({
    name: "limit",
    description: "조회할 순위 개수",
    type: "number",
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "일일 순위 조회 성공",
  })
  @Get("rankings/daily")
  async getDailyRanking(
    @Query("limit") limit?: string,
  ): Promise<PopularityRankingsListDto> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const rankings =
      await this.popularityRankingService.getDailyRanking(limitNum);
    return {
      rankings: rankings as PopularityRankingsResponseDto[],
      type: "daily",
      timestamp: new Date(),
    };
  }

  /**
   * 급상승 콘서트 조회
   *
   * @description
   * 지난 시간 대비 순위가 크게 상승한 콘서트를 조회합니다.
   */
  @ApiOperation({
    summary: "급상승 콘서트 순위",
    description: "지난 시간 대비 급상승한 콘서트 순위 (trending)",
  })
  @ApiQuery({
    name: "limit",
    description: "조회할 순위 개수",
    type: "number",
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "급상승 순위 조회 성공",
  })
  @Get("rankings/trending")
  async getTrendingConcerts(
    @Query("limit") limit?: string,
  ): Promise<PopularityRankingsListDto> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const rankings =
      await this.popularityRankingService.getTrendingConcerts(limitNum);
    return {
      rankings: rankings as PopularityRankingsResponseDto[],
      type: "trending",
      timestamp: new Date(),
    };
  }

  /**
   * 초근접 매진 콘서트 조회
   *
   * @description
   * 매진이 임박한 (80% 이상 예약) 콘서트를 조회합니다.
   */
  @ApiOperation({
    summary: "초근접 매진 콘서트",
    description: "80% 이상 예약된 매진 임박 콘서트 (nearly sold-out)",
  })
  @ApiQuery({
    name: "limit",
    description: "조회할 개수",
    type: "number",
    required: false,
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: "매진 임박 콘서트 조회 성공",
  })
  @Get("rankings/nearly-sold-out")
  async getNearlySoldOutConcerts(
    @Query("limit") limit?: string,
  ): Promise<PopularityRankingsListDto> {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    const rankings =
      await this.popularityRankingService.getNearlySoldOutConcerts(limitNum);
    return {
      rankings: rankings as PopularityRankingsResponseDto[],
      type: "nearly-sold-out",
      timestamp: new Date(),
    };
  }

  /**
   * 특정 콘서트의 인기도 정보 조회
   *
   * @description
   * 특정 콘서트 일정의 현재 인기도 지표를 조회합니다.
   */
  @ApiOperation({
    summary: "콘서트 인기도 정보",
    description: "특정 콘서트 일정의 인기도 지표 조회",
  })
  @ApiParam({
    name: "concertId",
    description: "콘서트 ID",
    type: "number",
    example: 1,
  })
  @ApiParam({
    name: "scheduleId",
    description: "콘서트 일정 ID",
    type: "number",
    example: 5,
  })
  @ApiResponse({
    status: 200,
    description: "인기도 정보 조회 성공",
  })
  @Get(":concertId/schedules/:scheduleId/popularity")
  async getConcertPopularity(
    @Param("concertId", ParseIntPipe) concertId: number,
    @Param("scheduleId", ParseIntPipe) scheduleId: number,
  ): Promise<PopularityRankingsResponseDto> {
    return (await this.popularityRankingService.getConcertPopularity(
      concertId,
      scheduleId,
    )) as PopularityRankingsResponseDto;
  }
}
