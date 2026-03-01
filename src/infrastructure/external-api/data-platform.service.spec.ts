import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataPlatformService } from './data-platform.service';
import { DataPlatformApiClient } from './data-platform.api-client';
import { ReservationConfirmedEvent } from '../../reservation/events/reservation-confirmed.event';

describe('DataPlatformService', () => {
  let service: DataPlatformService;
  let apiClient: DataPlatformApiClient;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataPlatformService,
        {
          provide: DataPlatformApiClient,
          useValue: {
            sendReservationData: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DataPlatformService>(DataPlatformService);
    apiClient = module.get<DataPlatformApiClient>(DataPlatformApiClient);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleReservationConfirmed', () => {
    it('should send reservation data to data platform on event', async () => {
      const event = new ReservationConfirmedEvent(
        1,
        100,
        1,
        5,
        10,
        new Date(),
      );

      jest
        .spyOn(apiClient, 'sendReservationData')
        .mockResolvedValue(true);

      await service.handleReservationConfirmed(event);

      expect(apiClient.sendReservationData).toHaveBeenCalledWith(
        expect.objectContaining({
          reservationId: 1,
          userId: 100,
          concertId: 1,
          concertScheduleId: 5,
          seatId: 10,
        }),
      );
    });

    it('should handle api client failure gracefully', async () => {
      const event = new ReservationConfirmedEvent(
        1,
        100,
        1,
        5,
        10,
        new Date(),
      );

      jest
        .spyOn(apiClient, 'sendReservationData')
        .mockResolvedValue(false);

      // 실패해도 에러를 던지지 않음
      await expect(
        service.handleReservationConfirmed(event),
      ).resolves.toBeUndefined();
    });
  });

  describe('checkHealth', () => {
    it('should return true on health check', async () => {
      const result = await service.checkHealth();
      expect(result).toBe(true);
    });
  });
});
