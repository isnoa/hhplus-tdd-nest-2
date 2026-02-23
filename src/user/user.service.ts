import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { PointHistory, PointHistoryType } from './entities/point-history.entity';
import { ChargePointDto } from './dto/charge-point.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PointHistory)
    private readonly pointHistoryRepository: Repository<PointHistory>,
    private readonly dataSource: DataSource,
  ) {}

  async getUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    return user;
  }

  async getPoint(userId: number): Promise<{ userId: number; point: number }> {
    const user = await this.getUser(userId);
    return { userId: user.id, point: user.point };
  }

  /**
   * Charge points for a user.
   * Uses optimistic locking to handle concurrent requests safely.
   */
  async chargePoint(dto: ChargePointDto): Promise<{ userId: number; point: number }> {
    if (dto.amount <= 0) {
      throw new BadRequestException('충전 금액은 0보다 커야 합니다.');
    }

    return await this.dataSource.transaction(async (manager) => {
      // Pessimistic write lock to prevent concurrent updates
      const user = await manager
        .createQueryBuilder(User, 'user')
        .setLock('pessimistic_write')
        .where('user.id = :id', { id: dto.userId })
        .getOne();

      if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');

      user.point += dto.amount;
      await manager.save(user);

      const history = manager.create(PointHistory, {
        userId: user.id,
        amount: dto.amount,
        type: PointHistoryType.CHARGE,
        balanceAfter: user.point,
      });
      await manager.save(history);

      return { userId: user.id, point: user.point };
    });
  }

  /**
   * Deduct points from a user inside a transaction.
   * Caller must provide the transactional manager.
   */
  async deductPoint(
    userId: number,
    amount: number,
    manager: import('typeorm').EntityManager,
  ): Promise<User> {
    const user = await manager
      .createQueryBuilder(User, 'user')
      .setLock('pessimistic_write')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) throw new NotFoundException('사용자를 찾을 수 없습니다.');
    if (user.point < amount) throw new BadRequestException('포인트가 부족합니다.');

    user.point -= amount;
    await manager.save(user);

    const history = manager.create(PointHistory, {
      userId: user.id,
      amount,
      type: PointHistoryType.USE,
      balanceAfter: user.point,
    });
    await manager.save(history);

    return user;
  }
}
