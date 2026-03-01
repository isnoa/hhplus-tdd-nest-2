/**
 * QueueService Port Interface
 * 대기열 관련 로직을 위한 외부 Port
 */
export interface IQueueServicePort {
  checkQueueToken(token: string, userId: number): Promise<boolean>;
  expireToken(token: string): Promise<boolean>;
}
