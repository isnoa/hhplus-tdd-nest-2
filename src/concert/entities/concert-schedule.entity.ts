import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Concert } from './concert.entity';
import { Seat } from './seat.entity';

@Entity('concert_schedules')
export class ConcertSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  concertId: number;

  @ManyToOne(() => Concert, (concert) => concert.schedules)
  concert: Concert;

  @Column({ type: 'date' })
  concertDate: string;

  @Column({ type: 'int', default: 50 })
  totalSeats: number;

  /** Seat price in points */
  @Column({ type: 'int', default: 0 })
  price: number;

  @OneToMany(() => Seat, (seat) => seat.concertSchedule)
  seats: Seat[];

  @CreateDateColumn()
  createdAt: Date;
}
