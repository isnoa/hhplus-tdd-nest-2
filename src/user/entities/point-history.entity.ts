export { PointHistoryType } from '../../common/enums/point-history-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { User } from './user.entity';
import { PointHistoryType } from '../../common/enums/point-history-type.enum';

@Entity('point_histories')
export class PointHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, (user) => user.pointHistories)
  user: User;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'enum', enum: PointHistoryType })
  type: PointHistoryType;

  @Column({ type: 'int' })
  balanceAfter: number;

  @CreateDateColumn()
  createdAt: Date;
}
