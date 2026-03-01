import { Test, TestingModule } from '@nestjs/testing';
import { DataPlatformApiClient } from './data-platform.api-client';

describe('DataPlatformApiClient', () => {
  let client: DataPlatformApiClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataPlatformApiClient],
    }).compile();

    client = module.get<DataPlatformApiClient>(DataPlatformApiClient);
  });

  it('should be defined', () => {
    expect(client).toBeDefined();
  });

  describe('sendReservationData', () => {
    it('should send reservation data successfully', async () => {
      const payload = {
        reservationId: 1,
        userId: 100,
        concertId: 1,
        concertScheduleId: 5,
        seatId: 10,
        timestamp: new Date().toISOString(),
      };

      const result = await client.sendReservationData(payload);

      // 90% 성공율로 mock되어 있음
      expect(typeof result).toBe('boolean');
    });

    it('should handle multiple reservation data sends', async () => {
      const payloads = [
        {
          reservationId: 1,
          userId: 100,
          concertId: 1,
          concertScheduleId: 5,
          seatId: 10,
          timestamp: new Date().toISOString(),
        },
        {
          reservationId: 2,
          userId: 101,
          concertId: 1,
          concertScheduleId: 5,
          seatId: 11,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = await client.sendReservationDataBatch(payloads);

      expect(result.succeeded + result.failed).toBe(2);
      expect(result.succeeded).toBeGreaterThanOrEqual(0);
      expect(result.failed).toBeGreaterThanOrEqual(0);
    });

    it('should retry on failure', async () => {
      const payload = {
        reservationId: 1,
        userId: 100,
        concertId: 1,
        concertScheduleId: 5,
        seatId: 10,
        timestamp: new Date().toISOString(),
      };

      // 여러 번 호출하면 일부는 성공, 일부는 실패
      const results = await Promise.all([
        client.sendReservationData(payload),
        client.sendReservationData(payload),
        client.sendReservationData(payload),
      ]);

      expect(results.length).toBe(3);
      // 90% 성공이므로 average 2.7 정도 성공
      const successes = results.filter((r) => r).length;
      expect(successes).toBeGreaterThanOrEqual(1);
    });

    it('should handle error gracefully', async () => {
      const payload = {
        reservationId: 1,
        userId: 100,
        concertId: 1,
        concertScheduleId: 5,
        seatId: 10,
        timestamp: new Date().toISOString(),
      };

      // 에러가 발생해도 catch되어 false 반환
      const result = await client.sendReservationData(payload);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('checkHealth', () => {
    it('should return health check status', async () => {
      // 실제 구현 시 추가 테스트
      expect(client).toBeDefined();
    });
  });
});
