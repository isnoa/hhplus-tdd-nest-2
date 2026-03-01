import { Test, TestingModule } from '@nestjs/testing';
import { PopularityRankingService } from './popularity-ranking.service';

describe('PopularityRankingService', () => {
  let service: PopularityRankingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PopularityRankingService],
    }).compile();

    service = module.get<PopularityRankingService>(PopularityRankingService);
  });

  afterEach(async () => {
    await service.clearRankings();
  });

  afterAll(async () => {
    // Cleanup after all tests
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordReservation', () => {
    it('should record a reservation and update rankings', async () => {
      await service.recordReservation(1, 1, 100);

      const popularity = await service.getConcertPopularity(1, 1);
      expect(popularity.reservationCount).toBe(1);
      expect(popularity.popularityScore).toBeGreaterThan(0);
    });

    it('should increment reservation count on multiple calls', async () => {
      await service.recordReservation(1, 1, 100);
      await service.recordReservation(1, 1, 100);
      await service.recordReservation(1, 1, 100);

      const popularity = await service.getConcertPopularity(1, 1);
      expect(popularity.reservationCount).toBe(3);
    });

    it('should calculate sell-out ratio correctly', async () => {
      const totalSeats = 100;
      for (let i = 0; i < 50; i++) {
        await service.recordReservation(1, 1, totalSeats);
      }

      const popularity = await service.getConcertPopularity(1, 1);
      expect(popularity.selloutRatio).toBeCloseTo(0.5, 1);
    });
  });

  describe('getRealTimeRanking', () => {
    it('should return empty ranking initially', async () => {
      const rankings = await service.getRealTimeRanking(10);
      expect(rankings).toEqual([]);
    });

    it('should return concerts sorted by popularity score', async () => {
      // Concert 1: 50 reservations
      for (let i = 0; i < 50; i++) {
        await service.recordReservation(1, 1, 100);
      }

      // Concert 2: 30 reservations
      for (let i = 0; i < 30; i++) {
        await service.recordReservation(2, 2, 100);
      }

      // Concert 3: 70 reservations
      for (let i = 0; i < 70; i++) {
        await service.recordReservation(3, 3, 100);
      }

      const rankings = await service.getRealTimeRanking(10);
      expect(rankings.length).toBe(3);
      expect(rankings[0].concertScheduleId).toBe(3); // Concert 3 should be first
      expect(rankings[1].concertScheduleId).toBe(1); // Concert 1 should be second
      expect(rankings[2].concertScheduleId).toBe(2); // Concert 2 should be third
    });

    it('should respect limit parameter', async () => {
      for (let i = 1; i <= 15; i++) {
        await service.recordReservation(i, i, 100);
      }

      const rankings = await service.getRealTimeRanking(5);
      expect(rankings.length).toBe(5);
    });
  });

  describe('getNearlySoldOutConcerts', () => {
    it('should return concerts with 80%+ sell-out ratio', async () => {
      const totalSeats = 100;
      const seatsToReserve = 85; // 85% sell-out

      for (let i = 0; i < seatsToReserve; i++) {
        await service.recordReservation(1, 1, totalSeats);
      }

      const nearlySoldOut = await service.getNearlySoldOutConcerts(10);
      expect(nearlySoldOut.length).toBe(1);
      expect(nearlySoldOut[0].selloutRatio).toBeGreaterThanOrEqual(0.8);
    });

    it('should not include concerts below 80% sell-out', async () => {
      const totalSeats = 100;
      const seatsToReserve = 70; // 70% sell-out

      for (let i = 0; i < seatsToReserve; i++) {
        await service.recordReservation(1, 1, totalSeats);
      }

      const nearlySoldOut = await service.getNearlySoldOutConcerts(10);
      expect(nearlySoldOut.length).toBe(0);
    });

    it('should sort by sell-out ratio descending', async () => {
      // Concert 1: 85% sell-out
      for (let i = 0; i < 85; i++) {
        await service.recordReservation(1, 1, 100);
      }

      // Concert 2: 95% sell-out
      for (let i = 0; i < 95; i++) {
        await service.recordReservation(2, 2, 100);
      }

      const nearlySoldOut = await service.getNearlySoldOutConcerts(10);
      expect(nearlySoldOut[0].concertScheduleId).toBe(2); // 95% first
      expect(nearlySoldOut[1].concertScheduleId).toBe(1); // 85% second
    });
  });

  describe('getTrendingConcerts', () => {
    it('should calculate trending based on rank change', async () => {
      // This test would require mocking or manipulation of time
      // Simplified version to verify the method exists and doesn't throw
      const trending = await service.getTrendingConcerts(10);
      expect(Array.isArray(trending)).toBe(true);
    });
  });

  describe('clearRankings', () => {
    it('should clear all ranking data', async () => {
      // Create some data
      for (let i = 0; i < 10; i++) {
        await service.recordReservation(1, 1, 100);
      }

      let rankings = await service.getRealTimeRanking(10);
      expect(rankings.length).toBeGreaterThan(0);

      // Clear
      await service.clearRankings();

      rankings = await service.getRealTimeRanking(10);
      expect(rankings.length).toBe(0);
    });
  });
});
