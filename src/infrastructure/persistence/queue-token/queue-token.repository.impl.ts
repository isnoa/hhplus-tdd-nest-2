import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { QueueToken } from './queue-token.entity';
import { IQueueTokenRepository } from '../../domain/repositories/queue-token.repository.interface';

/**
 * Queue Token Repository Implementation
 * DB 기반 대기열 토큰 관리
 */
@Injectable()
export class QueueTokenRepository implements IQueueTokenRepository {
  constructor(
    @InjectRepository(QueueToken)
    private readonly queueTokenRepository: Repository<QueueToken>,
  ) {}

  async issueToken(userId: number, expiresAt: Date): Promise<string> {
    const token = uuidv4();
    
    await this.queueTokenRepository.insert({
      token,
      userId,
      expiresAt,
      createdAt: new Date(),
    });

    return token;
  }

  async getUserIdByToken(token: string): Promise<number | null> {
    const record = await this.queueTokenRepository.findOne({
      where: { token },
    });

    if (!record) {
      return null;
    }

    // 만료 여부 확인
    if (new Date() > record.expiresAt) {
      return null;
    }

    return record.userId;
  }

  async isTokenValid(token: string): Promise<boolean> {
    const record = await this.queueTokenRepository.findOne({
      where: { token },
    });

    if (!record) {
      return false;
    }

    return new Date() <= record.expiresAt;
  }

  async deleteToken(token: string): Promise<void> {
    await this.queueTokenRepository.delete({ token });
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.queueTokenRepository.delete({
      expiresAt: { $lt: new Date() } as any,
    });
    return result.affected || 0;
  }

  async getActiveTokenCount(userId: number): Promise<number> {
    const count = await this.queueTokenRepository.count({
      where: {
        userId,
      },
    });

    return count;
  }
}
