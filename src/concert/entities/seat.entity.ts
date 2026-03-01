export { SeatStatus } from '../../common/enums/seat-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ConcertSchedule } from './concert-schedule.entity';
import { SeatStatus } from '../../common/enums/seat-status.enum';

@Entity('seats')
export class Seat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  concertScheduleId: number;

  @ManyToOne(() => ConcertSchedule, (schedule) => schedule.seats)
  concertSchedule: ConcertSchedule;

  /** Seat number 1 ~ 50 */
  @Column({ type: 'int' })
  seatNumber: number;

  @Column({ type: 'enum', enum: SeatStatus, default: SeatStatus.AVAILABLE })
  status: SeatStatus;

  /** Temporarily reserved until this time */
  @Column({ type: 'datetime', nullable: true })
  tempReservedUntil: Date | null;

  /** User who holds the temporary reservation */
  @Column({ type: 'int', nullable: true })
  tempReservedUserId: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
