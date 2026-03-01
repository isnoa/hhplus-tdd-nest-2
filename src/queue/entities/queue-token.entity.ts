export { QueueTokenStatus } from '../../common/enums/queue-token-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { QueueTokenStatus } from '../../common/enums/queue-token-status.enum';

@Entity('queue_tokens')
export class QueueToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  /** UUID token value sent to client */
  @Column({ length: 36, unique: true })
  token: string;

  @Column({ type: 'enum', enum: QueueTokenStatus, default: QueueTokenStatus.WAITING })
  status: QueueTokenStatus;

  /** Nullable: set when token becomes ACTIVE */
  @Column({ type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
