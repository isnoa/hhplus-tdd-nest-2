import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../user/entities/user.entity';
import { IUserBalanceRepository } from '../../domain/repositories/user-balance.repository.interface';

/**
 * User Balance Repository Implementation
 * 사용자 잔액(포인트) 관리 (낙관적 락 활용)
 */
@Injectable()
export class UserBalanceRepository implements IUserBalanceRepository {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getBalance(userId: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'point'],
    });

    return user?.point || 0;
  }

  async deductBalance(userId: number, amount: number): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'point'],
    });

    if (!user || user.point < amount) {
      return false;
    }

    const result = await this.userRepository.update(
      { id: userId },
      { point: user.point - amount },
    );

    return (result.affected || 0) > 0;
  }

  async chargeBalance(userId: number, amount: number): Promise<number> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'point'],
    });

    if (!user) {
      return -1;
    }

    const newBalance = user.point + amount;
    await this.userRepository.update(
      { id: userId },
      { point: newBalance },
    );

    return newBalance;
  }

  async hasSufficientBalance(userId: number, amount: number): Promise<boolean> {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }

  async updateBalanceWithVersion(
    userId: number,
    amount: number,
    currentVersion: number,
  ): Promise<boolean> {
    // 낙관적 락을 이용한 업데이트
    // version이 일치하는 경우에만 업데이트
    const result = await this.userRepository
      .createQueryBuilder()
      .update()
      .set({
        point: () => `point - ${amount}`,
        version: () => `version + 1`,
      })
      .where('id = :userId', { userId })
      .where('version = :version', { version: currentVersion })
      .execute();

    return (result.affected || 0) > 0;
  }

  async getVersionInfo(
    userId: number,
  ): Promise<{ version: number; point: number } | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'version', 'point'],
    });

    if (!user) {
      return null;
    }

    return {
      version: user.version,
      point: user.point,
    };
  }
}
