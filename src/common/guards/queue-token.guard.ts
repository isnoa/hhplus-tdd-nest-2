import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueueToken, QueueTokenStatus } from '../../queue/entities/queue-token.entity';

@Injectable()
export class QueueTokenGuard implements CanActivate {
  constructor(
    @InjectRepository(QueueToken)
    private readonly queueTokenRepository: Repository<QueueToken>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-queue-token'];

    if (!token) {
      throw new UnauthorizedException('대기열 토큰이 필요합니다.');
    }

    const queueToken = await this.queueTokenRepository.findOne({
      where: { token, status: QueueTokenStatus.ACTIVE },
    });

    if (!queueToken) {
      throw new UnauthorizedException('유효하지 않은 대기열 토큰입니다.');
    }

    if (queueToken.expiresAt && queueToken.expiresAt < new Date()) {
      throw new UnauthorizedException('만료된 대기열 토큰입니다.');
    }

    // Attach queue token info to request
    request.queueToken = queueToken;
    request.userId = queueToken.userId;
    return true;
  }
}
