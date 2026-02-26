import { Injectable } from "@nestjs/common";
import { IQueueServicePort } from "../../../core/application/ports/queue-service.port";
import { QueueService } from "../../../queue/queue.service";

/**
 * QueueServiceAdapter
 * QueueService를 통해 대기열 관련 기능에 접근하는 Adapter
 */
@Injectable()
export class QueueServiceAdapter implements IQueueServicePort {
  constructor(private readonly queueService: QueueService) {}

  async checkQueueToken(token: string, userId: number): Promise<boolean> {
    try {
      const queueToken = await this.queueService.getQueueToken(token);
      return queueToken && queueToken.userId === userId;
    } catch (error) {
      return false;
    }
  }

  async expireToken(token: string): Promise<boolean> {
    try {
      await this.queueService.expireToken(token);
      return true;
    } catch (error) {
      return false;
    }
  }
}
