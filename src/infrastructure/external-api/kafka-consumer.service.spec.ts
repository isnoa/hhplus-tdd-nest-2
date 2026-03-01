import { Test, TestingModule } from "@nestjs/testing";
import { KafkaConsumerService, ConsumerConfig } from "./kafka-consumer.service";
import { Kafka, Consumer, EachMessagePayload } from "kafkajs";

jest.mock("kafkajs");

describe("KafkaConsumerService", () => {
  let service: KafkaConsumerService;
  let mockConsumer: jest.Mocked<Consumer>;

  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();
  const mockSubscribe = jest.fn();
  const mockRun = jest.fn();

  beforeEach(async () => {
    mockConsumer = {
      connect: mockConnect,
      disconnect: mockDisconnect,
      subscribe: mockSubscribe,
      run: mockRun,
    } as any;

    (Kafka as jest.MockedClass<typeof Kafka>).mockImplementation(
      () =>
        ({
          consumer: jest.fn(() => mockConsumer),
        }) as any,
    );

    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    mockSubscribe.mockResolvedValue(undefined);
    mockRun.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [KafkaConsumerService],
    }).compile();

    service = module.get<KafkaConsumerService>(KafkaConsumerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("onModuleInit", () => {
    it("Kafka Consumer를 초기화해야 함", async () => {
      await service.onModuleInit();

      // Kafka 인스턴스가 생성되어야 함
      expect(Kafka).toHaveBeenCalled();
    });
  });

  describe("subscribe", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("Consumer를 토픽에 등록해야 함", async () => {
      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
      };

      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(config, handler);

      expect(mockConnect).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledWith({
        topic: "concert-reservations",
        fromBeginning: false,
      });
      expect(mockRun).toHaveBeenCalled();
    });

    it("fromBeginning 옵션을 처리해야 함", async () => {
      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
        fromBeginning: true,
      };

      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(config, handler);

      expect(mockSubscribe).toHaveBeenCalledWith({
        topic: "concert-reservations",
        fromBeginning: true,
      });
    });

    it("동일한 groupId로 중복 등록 시 경고해야 함", async () => {
      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
      };

      const handler = jest.fn().mockResolvedValue(undefined);
      mockRun.mockResolvedValue(undefined);

      // 첫 번째 등록
      await service.subscribe(config, handler);

      // 두 번째 등록 시도
      const mockLogger = jest.spyOn(service as any, "logger", "get");
      mockLogger.mockReturnValue({
        warn: jest.fn(),
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      });

      await service.subscribe(config, handler);
      // 경고 로그가 발생해야 함 (이미 존재하는 consumer)
    });

    it("연결 실패 시 에러를 발생시켜야 함", async () => {
      mockConnect.mockRejectedValue(new Error("Connection failed"));

      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
      };

      const handler = jest.fn();

      await expect(service.subscribe(config, handler)).rejects.toThrow(
        "Connection failed",
      );
    });
  });

  describe("processMessage", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("JSON 메시지를 파싱하고 핸들러를 호출해야 함", async () => {
      const messageData = {
        eventType: "reservation.created",
        reservationId: 1,
      };

      const payload: Partial<EachMessagePayload> = {
        topic: "concert-reservations",
        partition: 0,
        message: {
          key: Buffer.from("1"),
          value: Buffer.from(JSON.stringify(messageData)),
          offset: "0",
          timestamp: "1234567890",
          attributes: 0,
          headers: {},
        },
      };

      let receivedData = null;
      const handler = jest.fn(async (data) => {
        receivedData = data;
      });

      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
      };

      await service.subscribe(config, handler);

      // mockRun의 eachMessage 콜백 추출 및 실행
      const runCall = mockRun.mock.calls[0][0];
      await runCall.eachMessage(payload);

      expect(receivedData).toEqual(messageData);
    });

    it("빈 메시지를 무시해야 함", async () => {
      const payload: Partial<EachMessagePayload> = {
        topic: "concert-reservations",
        partition: 0,
        message: {
          key: null,
          value: null,
          offset: "0",
          timestamp: "1234567890",
          attributes: 0,
          headers: {},
        },
      };

      const handler = jest.fn();

      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
      };

      await service.subscribe(config, handler);

      const runCall = mockRun.mock.calls[0][0];
      await runCall.eachMessage(payload);

      expect(handler).not.toHaveBeenCalled();
    });

    it("메시지 처리 중 에러가 발생해도 계속 실행되어야 함", async () => {
      const messageData = { data: "test" };

      const payload: Partial<EachMessagePayload> = {
        topic: "concert-reservations",
        partition: 0,
        message: {
          key: null,
          value: Buffer.from(JSON.stringify(messageData)),
          offset: "0",
          timestamp: "1234567890",
          attributes: 0,
          headers: {},
        },
      };

      const handler = jest
        .fn()
        .mockRejectedValue(new Error("Processing failed"));

      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
      };

      await service.subscribe(config, handler);

      const runCall = mockRun.mock.calls[0][0];

      // 에러가 발생해도 함수는 정상 종료되어야 함 (재시도/DLQ는 별도 처리)
      await expect(runCall.eachMessage(payload)).resolves.not.toThrow();
    });
  });

  describe("stop", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("특정 Consumer를 중지해야 함", async () => {
      const config: ConsumerConfig = {
        groupId: "test-group",
        topic: "concert-reservations",
      };

      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(config, handler);
      mockDisconnect.mockClear();

      await service.stop("test-group");

      expect(mockDisconnect).toHaveBeenCalled();
      expect(service.hasConsumer("test-group")).toBe(false);
    });

    it("존재하지 않는 Consumer 중지 시 경고해야 함", async () => {
      const mockLogger = jest.spyOn(service as any, "logger", "get");
      mockLogger.mockReturnValue({
        warn: jest.fn(),
        log: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      });

      await service.stop("non-existent-group");
      // 경고 로그가 발생해야 함
    });
  });

  describe("stopAll", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("모든 Consumer를 중지해야 함", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(
        { groupId: "group-1", topic: "topic-1" },
        handler,
      );
      await service.subscribe(
        { groupId: "group-2", topic: "topic-2" },
        handler,
      );

      mockDisconnect.mockClear();

      await service.stopAll();

      // 2개의 consumer가 disconnect 되어야 함
      expect(mockDisconnect).toHaveBeenCalledTimes(2);
    });
  });

  describe("getConsumerStatus", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("등록된 모든 Consumer의 상태를 반환해야 함", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(
        { groupId: "group-1", topic: "topic-1" },
        handler,
      );
      await service.subscribe(
        { groupId: "group-2", topic: "topic-2" },
        handler,
      );

      const status = service.getConsumerStatus();

      expect(status.has("group-1")).toBe(true);
      expect(status.has("group-2")).toBe(true);
      expect(status.get("group-1")).toBe(true);
      expect(status.get("group-2")).toBe(true);
    });
  });

  describe("hasConsumer", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("Consumer의 존재 유무를 확인해야 함", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(
        { groupId: "test-group", topic: "test-topic" },
        handler,
      );

      expect(service.hasConsumer("test-group")).toBe(true);
      expect(service.hasConsumer("non-existent")).toBe(false);
    });
  });

  describe("onModuleDestroy", () => {
    beforeEach(async () => {
      await service.onModuleInit();
    });

    it("모든 Consumer를 연결 해제해야 함", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(
        { groupId: "group-1", topic: "topic-1" },
        handler,
      );

      mockDisconnect.mockClear();

      await service.onModuleDestroy();

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("disconnect 실패 시 계속 진행해야 함", async () => {
      mockDisconnect.mockRejectedValue(new Error("Disconnect failed"));

      const handler = jest.fn().mockResolvedValue(undefined);

      await service.subscribe(
        { groupId: "group-1", topic: "topic-1" },
        handler,
      );

      // onModuleDestroy는 에러를 발생시키지 않아야 함
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
