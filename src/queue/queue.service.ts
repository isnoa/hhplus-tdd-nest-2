import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { QueueToken, QueueTokenStatus } from './entities/queue-token.entity';
import { CreateQueueTokenDto } from './dto/create-queue-token.dto';

/** Max number of concurrently ACTIVE tokens */
const MAX_ACTIVE_TOKENS = 50;
/** Active token TTL in minutes */
const ACTIVE_TOKEN_TTL_MINUTES = 30;

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(QueueToken)
    private readonly queueTokenRepository: Repository<QueueToken>,
  ) {}

  // 유저에게 대기열 토큰을 발급합니다. 이미 토큰이 있으면 재사용하고, 없으면 새로 발급합니다.
  async issueToken(dto: CreateQueueTokenDto): Promise<{
    token: string;
    status: QueueTokenStatus;
    position: number | null;
    expiresAt: Date | null;
  }> {
    // 기존 토큰이 있으면 재사용
    const existing = await this.queueTokenRepository.findOne({
      where: [
        { userId: dto.userId, status: QueueTokenStatus.WAITING },
        { userId: dto.userId, status: QueueTokenStatus.ACTIVE },
      ],
    });

    if (existing) {
      if (
        existing.status === QueueTokenStatus.ACTIVE &&
        existing.expiresAt &&
        existing.expiresAt < new Date()
      ) {
        // 만료된 ACTIVE 토큰은 상태만 갱신
        existing.status = QueueTokenStatus.EXPIRED;
        await this.queueTokenRepository.save(existing);
      } else {
        const position =
          existing.status === QueueTokenStatus.WAITING
            ? await this.getQueuePosition(existing.id, existing.createdAt)
            : null;
        return {
          token: existing.token,
          status: existing.status,
          position,
          expiresAt: existing.expiresAt,
        };
      }
    }

    // 만료된 ACTIVE 토큰 정리
    await this.expireStaleTokens();

    const activeCount = await this.queueTokenRepository.count({
      where: { status: QueueTokenStatus.ACTIVE },
    });

    const shouldActivate = activeCount < MAX_ACTIVE_TOKENS;
    const now = new Date();
    const expiresAt = shouldActivate
      ? new Date(now.getTime() + ACTIVE_TOKEN_TTL_MINUTES * 60 * 1000)
      : null;

    const newToken = this.queueTokenRepository.create({
      userId: dto.userId,
      token: randomUUID(),
      status: shouldActivate ? QueueTokenStatus.ACTIVE : QueueTokenStatus.WAITING,
      expiresAt,
    });
    await this.queueTokenRepository.save(newToken);

    const position =
      newToken.status === QueueTokenStatus.WAITING
        ? await this.getQueuePosition(newToken.id, newToken.createdAt)
        : null;

    return {
      token: newToken.token,
      status: newToken.status,
      position,
      expiresAt: newToken.expiresAt,
    };
  }

  /** Get current queue status for a token */
  async getQueueStatus(token: string): Promise<{
    token: string;
    status: QueueTokenStatus;
    position: number | null;
    expiresAt: Date | null;
  }> {
    const queueToken = await this.queueTokenRepository.findOne({ where: { token } });
    if (!queueToken) throw new NotFoundException('토큰을 찾을 수 없습니다.');

    const position =
      queueToken.status === QueueTokenStatus.WAITING
        ? await this.getQueuePosition(queueToken.id, queueToken.createdAt)
        : null;

    return {
      token: queueToken.token,
      status: queueToken.status,
      position,
      expiresAt: queueToken.expiresAt,
    };
  }

  /** Expire a token (called after payment completes) */
  async expireToken(token: string): Promise<void> {
    const queueToken = await this.queueTokenRepository.findOne({ where: { token } });
    if (!queueToken) return;
    queueToken.status = QueueTokenStatus.EXPIRED;
    queueToken.expiresAt = new Date();
    await this.queueTokenRepository.save(queueToken);

    // 빈 슬롯만큼 WAITING 토큰을 ACTIVE로 전환
    await this.activateWaitingTokens();
  }

  /**
   * 토큰으로 사용자 정보를 조회 (Adapter에서 사용)
   */
  async getQueueToken(token: string): Promise<QueueToken | null> {
    return this.queueTokenRepository.findOne({ where: { token } });
  }

  /** Expire ACTIVE tokens whose expiresAt has passed */
  private async expireStaleTokens(): Promise<void> {
    await this.queueTokenRepository
      .createQueryBuilder()
      .update(QueueToken)
      .set({ status: QueueTokenStatus.EXPIRED })
      .where('status = :status AND expiresAt < :now', {
        status: QueueTokenStatus.ACTIVE,
        now: new Date(),
      })
      .execute();
  }

  /** Activate up to MAX_ACTIVE_TOKENS - current ACTIVE count waiting tokens */
  private async activateWaitingTokens(): Promise<void> {
    await this.expireStaleTokens();

    const activeCount = await this.queueTokenRepository.count({
      where: { status: QueueTokenStatus.ACTIVE },
    });
    const slots = MAX_ACTIVE_TOKENS - activeCount;
    if (slots <= 0) return;

    const waiting = await this.queueTokenRepository.find({
      where: { status: QueueTokenStatus.WAITING },
      order: { createdAt: 'ASC' },
      take: slots,
    });

    const expiresAt = new Date(
      Date.now() + ACTIVE_TOKEN_TTL_MINUTES * 60 * 1000,
    );
    for (const t of waiting) {
      t.status = QueueTokenStatus.ACTIVE;
      t.expiresAt = expiresAt;
    }
    if (waiting.length) await this.queueTokenRepository.save(waiting);
  }

  private async getQueuePosition(tokenId: number, createdAt: Date): Promise<number> {
    const ahead = await this.queueTokenRepository.count({
      where: {
        status: QueueTokenStatus.WAITING,
        createdAt: LessThan(createdAt),
      },
    });
    return ahead + 1;
  }

  async findActiveToken(userId: number): Promise<QueueToken | null> {
    return this.queueTokenRepository.findOne({
      where: { userId, status: QueueTokenStatus.ACTIVE },
    });
  }
}
