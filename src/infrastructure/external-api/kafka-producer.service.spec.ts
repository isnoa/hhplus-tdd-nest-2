import { Test, TestingModule } from "@nestjs/testing";
import { KafkaProducerService } from "./kafka-producer.service";
import { Kafka, Producer } from "kafkajs";

jest.mock("kafkajs");

describe("KafkaProducerService", () => {
  let service: KafkaProducerService;
  let mockProducer: jest.Mocked<Producer>;

  const mockSend = jest.fn();
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();
  const mockTransaction = jest.fn();

  beforeEach(async () => {
    // Mock Kafka와 Producer 설정
    mockProducer = {
      connect: mockConnect,
      disconnect: mockDisconnect,
      send: mockSend,
      transaction: mockTransaction,
    } as any;

    (Kafka as jest.MockedClass<typeof Kafka>).mockImplementation(
      () =>
        ({
          producer: jest.fn(() => mockProducer),
        }) as any,
    );

    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaProducerService],
    }).compile();

    service = module.get<KafkaProducerService>(KafkaProducerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("Kafka Producer를 초기화하고 연결해야 함", async () => {
      await service.onModuleInit();

      expect(mockConnect).toHaveBeenCalled();
      expect(service.isConnected()).toBe(true);
    });

    it("연결 실패 시 에러를 발생시켜야 함", async () => {
      mockConnect.mockRejectedValue(new Error("Connection failed"));

      await expect(service.onModuleInit()).rejects.toThrow("Connection failed");
    });
  });

  describe("sendMessage", () => {
    beforeEach(async () => {
      await service.onModuleInit();
      mockSend.mockResolvedValue([
        {
          topic: "concert-reservations",
          partition: 0,
          errorCode: 0,
          offset: "1",
          timestamp: "123456",
        },
      ]);
    });

    it("메시지를 Kafka로 전송해야 함", async () => {
      const messages = [
        {
          key: "1",
          value: JSON.stringify({ reservationId: 1 }),
        },
      ];

      await service.sendMessage("concert-reservations", messages);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "concert-reservations",
          messages: expect.arrayContaining([
            expect.objectContaining({
              key: "1",
              value: JSON.stringify({ reservationId: 1 }),
            }),
          ]),
        }),
      );
    });

    it("헤더를 포함하여 메시지를 전송해야 함", async () => {
      const messages = [
        {
          key: "1",
          value: JSON.stringify({ data: "test" }),
          headers: { "custom-header": "value" },
        },
      ];

      await service.sendMessage("concert-reservations", messages);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              headers: expect.objectContaining({
                "custom-header": "value",
              }),
            }),
          ]),
        }),
      );
    });

    it("전송 실패 시 에러를 발생시켜야 함", async () => {
      mockSend.mockRejectedValue(new Error("Send failed"));

      const messages = [{ key: "1", value: JSON.stringify({ data: "test" }) }];

      await expect(
        service.sendMessage("concert-reservations", messages),
      ).rejects.toThrow("Send failed");
    });
  });

  describe("publishReservationCreatedEvent", () => {
    beforeEach(async () => {
      await service.onModuleInit();
      mockSend.mockResolvedValue([]);
    });

    it("예약 생성 이벤트를 발행해야 함", async () => {
      const event = {
        reservationId: 1,
        userId: 100,
        concertId: 1,
        seatId: 10,
      };

      await service.publishReservationCreatedEvent(event);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "concert-reservations",
          messages: expect.arrayContaining([
            expect.objectContaining({
              value: expect.stringContaining("reservation.created"),
            }),
          ]),
        }),
      );
    });

    it("이벤트에 타임스탐프와 이벤트ID를 포함해야 함", async () => {
      const event = { concertId: 1 };

      await service.publishReservationCreatedEvent(event);

      const callArgs = mockSend.mock.calls[0][0];
      const messageValue = JSON.parse(callArgs.messages[0].value);

      expect(messageValue).toHaveProperty("eventId");
      expect(messageValue).toHaveProperty("eventTimestamp");
      expect(messageValue.eventType).toBe("reservation.created");
    });
  });

  describe("publishReservationConfirmedEvent", () => {
    beforeEach(async () => {
      await service.onModuleInit();
      mockSend.mockResolvedValue([]);
    });

    it("예약 확인 이벤트를 발행해야 함", async () => {
      const event = {
        reservationId: 1,
        userId: 100,
        concertId: 1,
        paymentAmount: 50000,
      };

      await service.publishReservationConfirmedEvent(event);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              value: expect.stringContaining("reservation.confirmed"),
            }),
          ]),
        }),
      );
    });
  });

  describe("publishBatch", () => {
    beforeEach(async () => {
      await service.onModuleInit();
      mockSend.mockResolvedValue([]);
    });

    it("여러 이벤트를 배치로 발행해야 함", async () => {
      const events = [
        { concertId: 1, reservationId: 1 },
        { concertId: 1, reservationId: 2 },
        { concertId: 2, reservationId: 3 },
      ];

      await service.publishBatch("concert-reservations", events);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.any(Object),
            expect.any(Object),
            expect.any(Object),
          ]),
        }),
      );

      const callArgs = mockSend.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(3);
    });
  });

  describe("publishWithTransaction", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("트랜잭션을 통해 메시지를 발행해야 함", async () => {
      const mockTransactionObj = {
        send: jest.fn().mockResolvedValue(undefined),
        commit: jest.fn().mockResolvedValue(undefined),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockTransaction.mockResolvedValue(mockTransactionObj);

      const messages = [{ key: "1", value: JSON.stringify({ data: "test" }) }];

      await service.publishWithTransaction("concert-reservations", messages);

      expect(mockTransactionObj.send).toHaveBeenCalled();
      expect(mockTransactionObj.commit).toHaveBeenCalled();
      expect(mockTransactionObj.abort).not.toHaveBeenCalled();
    });

    it("트랜잭션 실패 시 롤백해야 함", async () => {
      const mockTransactionObj = {
        send: jest.fn().mockRejectedValue(new Error("Transaction failed")),
        commit: jest.fn(),
        abort: jest.fn().mockResolvedValue(undefined),
      };

      mockTransaction.mockResolvedValue(mockTransactionObj);

      const messages = [{ key: "1", value: JSON.stringify({ data: "test" }) }];

      await expect(
        service.publishWithTransaction("concert-reservations", messages),
      ).rejects.toThrow("Transaction failed");

      expect(mockTransactionObj.abort).toHaveBeenCalled();
    });
  });

  describe("onModuleDestroy", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("Producer를 연결 해제해야 함", async () => {
      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe("isConnected", () => {
    it("Producer 연결 상태를 반환해야 함", async () => {
      expect(service.isConnected()).toBe(false);

      await service.onModuleInit();
      expect(service.isConnected()).toBe(true);
    });
  });
});
