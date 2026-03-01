import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";

export interface PopularityMetrics {
  concertId: number;
  concertScheduleId: number;
  reservationCount: number;
  popularityScore: number;
  selloutRatio: number;
  rank: number;
}

@Injectable()
export class PopularityRankingService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  // Redis Keys Patterns
  private readonly RESERVATION_COUNT_KEY = "popularity:reservations:"; // {concertId}:{scheduleId}
  private readonly HOURLY_RANKING_KEY = "popularity:ranking:hourly"; // Sorted Set
  private readonly DAILY_RANKING_KEY = "popularity:ranking:daily"; // Sorted Set
  private readonly REAL_TIME_RANKING_KEY = "popularity:ranking:realtime"; // Sorted Set
  private readonly SELL_OUT_RATIO_KEY = "popularity:sellout_ratio:"; // {concertId}:{scheduleId}
  private readonly SCHEDULE_TOTAL_SEATS_KEY = "schedule:total_seats:"; // {scheduleId}

  onModuleInit() {
    const host = process.env.REDIS_HOST || "localhost";
    const port = parseInt(process.env.REDIS_PORT || "6379", 10);
    this.client = new Redis({ host, port });
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }

  /**
   * 예약 성공 시 인기도 지표 업데이트
   * Called when a reservation is successfully created
   */
  async recordReservation(
    concertId: number,
    concertScheduleId: number,
    totalSeats?: number,
  ): Promise<void> {
    const reservationKey = `${this.RESERVATION_COUNT_KEY}${concertId}:${concertScheduleId}`;
    const selloutRatioKey = `${this.SELL_OUT_RATIO_KEY}${concertId}:${concertScheduleId}`;
    const seatsKey = `${this.SCHEDULE_TOTAL_SEATS_KEY}${concertScheduleId}`;

    // Store total seats (only if not already set and provided)
    if (totalSeats) {
      await this.client.setnx(seatsKey, totalSeats);
    }

    // Increment reservation counter
    const reservationCount = await this.client.incr(reservationKey);

    // Set expiry (24 hours for daily tracking)
    await this.client.expire(reservationKey, 86400);

    // If totalSeats is not provided, try to get it from Redis
    let totalSeatsForCalc = totalSeats;
    if (!totalSeatsForCalc) {
      const storedSeats = await this.client.get(seatsKey);
      if (storedSeats) {
        totalSeatsForCalc = parseInt(storedSeats, 10);
      } else {
        // If totalSeats is still not available, skip ratio calculation
        // This can happen with Kafka consumers that don't have full data
        return;
      }
    }

    // Calculate and update sell-out ratio
    const ratio = reservationCount / totalSeatsForCalc;
    await this.client.set(selloutRatioKey, ratio.toString(), "EX", 86400);

    // Update real-time ranking (using composite score)
    const score = this.calculatePopularityScore(reservationCount, ratio);
    await this.client.zadd(
      this.REAL_TIME_RANKING_KEY,
      score,
      `${concertId}:${concertScheduleId}`,
    );
    await this.client.expire(this.REAL_TIME_RANKING_KEY, 3600); // 1 hour for real-time

    // Update hourly ranking
    const currentHour = this.getCurrentHourKey();
    const hourlyRankingKey = `${this.HOURLY_RANKING_KEY}:${currentHour}`;
    await this.client.zadd(
      hourlyRankingKey,
      score,
      `${concertId}:${concertScheduleId}`,
    );
    await this.client.expire(hourlyRankingKey, 86400); // 24 hours

    // Update daily ranking
    const currentDay = this.getCurrentDayKey();
    const dailyRankingKey = `${this.DAILY_RANKING_KEY}:${currentDay}`;
    await this.client.zadd(
      dailyRankingKey,
      score,
      `${concertId}:${concertScheduleId}`,
    );
    await this.client.expire(dailyRankingKey, 604800); // 7 days
  }

  /**
   * 실시간 인기도 순위 조회
   */
  async getRealTimeRanking(limit: number = 10): Promise<PopularityMetrics[]> {
    const results = await this.client.zrevrange(
      this.REAL_TIME_RANKING_KEY,
      0,
      limit - 1,
      "WITHSCORES",
    );

    return this.formatRankingResults(results, 0);
  }

  /**
   * 시간별 인기도 순위 조회
   */
  async getHourlyRanking(limit: number = 10): Promise<PopularityMetrics[]> {
    const currentHour = this.getCurrentHourKey();
    const hourlyRankingKey = `${this.HOURLY_RANKING_KEY}:${currentHour}`;

    const results = await this.client.zrevrange(
      hourlyRankingKey,
      0,
      limit - 1,
      "WITHSCORES",
    );

    return this.formatRankingResults(results, 0);
  }

  /**
   * 일일 인기도 순위 조회
   */
  async getDailyRanking(limit: number = 10): Promise<PopularityMetrics[]> {
    const currentDay = this.getCurrentDayKey();
    const dailyRankingKey = `${this.DAILY_RANKING_KEY}:${currentDay}`;

    const results = await this.client.zrevrange(
      dailyRankingKey,
      0,
      limit - 1,
      "WITHSCORES",
    );

    return this.formatRankingResults(results, 0);
  }

  /**
   * 특정 콘서트의 인기도 지표 조회
   */
  async getConcertPopularity(
    concertId: number,
    concertScheduleId: number,
  ): Promise<PopularityMetrics> {
    const reservationKey = `${this.RESERVATION_COUNT_KEY}${concertId}:${concertScheduleId}`;
    const selloutRatioKey = `${this.SELL_OUT_RATIO_KEY}${concertId}:${concertScheduleId}`;
    const seatsKey = `${this.SCHEDULE_TOTAL_SEATS_KEY}${concertScheduleId}`;

    const [count, ratio, totalSeats] = await Promise.all([
      this.client.get(reservationKey),
      this.client.get(selloutRatioKey),
      this.client.get(seatsKey),
    ]);

    const reservationCount = parseInt(count || "0", 10);
    const selloutRatio = parseFloat(ratio || "0");
    const score = this.calculatePopularityScore(reservationCount, selloutRatio);

    return {
      concertId,
      concertScheduleId,
      reservationCount,
      popularityScore: score,
      selloutRatio,
      rank: -1, // Will be set by caller if needed
    };
  }

  /**
   * 상위 N개 콘서트 인기도 조회 (종합)
   */
  async getTopConcerts(limit: number = 10): Promise<PopularityMetrics[]> {
    const results = await this.getRealTimeRanking(limit);
    return results;
  }

  /**
   * 급상승 콘서트 조회 (지난 시간 대비 상승도)
   */
  async getTrendingConcerts(limit: number = 10): Promise<PopularityMetrics[]> {
    const currentHour = this.getCurrentHourKey();
    const previousHour = this.getPreviousHourKey();

    const currentHourlyKey = `${this.HOURLY_RANKING_KEY}:${currentHour}`;
    const previousHourlyKey = `${this.HOURLY_RANKING_KEY}:${previousHour}`;

    const currentResults = await this.client.zrevrange(
      currentHourlyKey,
      0,
      -1,
      "WITHSCORES",
    );
    const previousResults = await this.client.zrevrange(
      previousHourlyKey,
      0,
      -1,
      "WITHSCORES",
    );

    // Calculate trending based on rank change
    const trending = this.calculateTrendingConcerts(
      currentResults,
      previousResults,
      limit,
    );

    return trending;
  }

  /**
   * 초근접 매진 (80% 이상) 콘서트 조회
   */
  async getNearlySoldOutConcerts(
    limit: number = 10,
  ): Promise<PopularityMetrics[]> {
    const keys = await this.client.keys(`${this.SELL_OUT_RATIO_KEY}*`);
    const metrics: PopularityMetrics[] = [];

    for (const key of keys) {
      const ratio = parseFloat(await this.client.get(key)) || 0;

      if (ratio >= 0.8) {
        // 80% 이상
        const [concertId, concertScheduleId] = key
          .replace(this.SELL_OUT_RATIO_KEY, "")
          .split(":")
          .map(Number);

        const popularity = await this.getConcertPopularity(
          concertId,
          concertScheduleId,
        );
        metrics.push(popularity);
      }
    }

    // Sort by sell-out ratio descending
    metrics.sort((a, b) => b.selloutRatio - a.selloutRatio);
    return metrics.slice(0, limit);
  }

  /**
   * 랭킹 데이터 초기화 (테스트/관리 목적)
   */
  async clearRankings(): Promise<void> {
    const keys = await this.client.keys("popularity:*");
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  // ============ 내부 헬퍼 메서드 ============

  /**
   * 인기도 점수 계산 (가중 평균)
   * Formula: (reservationCount * 0.7) + (selloutRatio * 100 * 0.3)
   */
  private calculatePopularityScore(
    reservationCount: number,
    selloutRatio: number,
  ): number {
    const velocityScore = reservationCount;
    const selloutScore = selloutRatio * 100;
    return velocityScore * 0.7 + selloutScore * 0.3;
  }

  /**
   * 현재 시간 키 생성 (YYYY-MM-DD-HH 형식)
   */
  private getCurrentHourKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}`;
  }

  /**
   * 이전 시간 키 생성
   */
  private getPreviousHourKey(): string {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    return `${oneHourAgo.getFullYear()}-${String(oneHourAgo.getMonth() + 1).padStart(2, "0")}-${String(oneHourAgo.getDate()).padStart(2, "0")}-${String(oneHourAgo.getHours()).padStart(2, "0")}`;
  }

  /**
   * 현재 날짜 키 생성 (YYYY-MM-DD 형식)
   */
  private getCurrentDayKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }

  /**
   * 랭킹 결과 포맷팅
   */
  private formatRankingResults(
    results: (string | number)[],
    startRank: number,
  ): PopularityMetrics[] {
    const metrics: PopularityMetrics[] = [];

    for (let i = 0; i < results.length; i += 2) {
      const key = results[i] as string;
      const score = parseFloat(results[i + 1] as string);
      const [concertId, concertScheduleId] = key.split(":").map(Number);

      metrics.push({
        concertId,
        concertScheduleId,
        reservationCount: 0, // Will be calculated separately if needed
        popularityScore: score,
        selloutRatio: 0,
        rank: startRank + metrics.length + 1,
      });
    }

    return metrics;
  }

  /**
   * 급상승 콘서트 계산 (지난 시간 대비 순위 변동)
   */
  private calculateTrendingConcerts(
    current: (string | number)[],
    previous: (string | number)[],
    limit: number,
  ): PopularityMetrics[] {
    const trendingMap = new Map<string, { score: number; trend: number }>();

    // 현재 순위
    for (let i = 0; i < current.length; i += 2) {
      const key = current[i] as string;
      const score = parseFloat(current[i + 1] as string);
      const currentRank = i / 2;
      trendingMap.set(key, { score, trend: 0 });
    }

    // 이전 순위와 비교
    for (let i = 0; i < previous.length; i += 2) {
      const key = previous[i] as string;
      const previousRank = i / 2;

      if (trendingMap.has(key)) {
        const current = trendingMap.get(key);
        current.trend = previousRank - (current.trend || 0); // 상승도
      }
    }

    // 트렌드 점수 기준 정렬
    const trending = Array.from(trendingMap.entries())
      .map(([key, value]) => {
        const [concertId, concertScheduleId] = key.split(":").map(Number);
        return {
          concertId,
          concertScheduleId,
          reservationCount: 0,
          popularityScore: value.score,
          selloutRatio: 0,
          rank: 0,
          _trend: value.trend,
        };
      })
      .sort((a, b) => b._trend - a._trend)
      .slice(0, limit)
      .map((item, idx) => ({
        ...item,
        rank: idx + 1,
      }));

    return trending as PopularityMetrics[];
  }
}
