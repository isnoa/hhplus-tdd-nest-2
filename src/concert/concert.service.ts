import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Concert } from './entities/concert.entity';
import { ConcertSchedule } from './entities/concert-schedule.entity';
import { Seat, SeatStatus } from './entities/seat.entity';

@Injectable()
export class ConcertService {
  constructor(
    @InjectRepository(Concert)
    private readonly concertRepository: Repository<Concert>,
    @InjectRepository(ConcertSchedule)
    private readonly scheduleRepository: Repository<ConcertSchedule>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
  ) {}

  /** 예약 가능한 날짜 목록 조회 */
  async getAvailableDates(concertId: number): Promise<ConcertSchedule[]> {
    const concert = await this.concertRepository.findOne({ where: { id: concertId } });
    if (!concert) throw new NotFoundException('콘서트를 찾을 수 없습니다.');

    const today = new Date().toISOString().split('T')[0];

    // 만료된 임시 예약 좌석 해제
    await this.releaseExpiredTempReservations();

    const schedules = await this.scheduleRepository.find({
      where: {
        concertId,
        concertDate: MoreThanOrEqual(today),
      },
      order: { concertDate: 'ASC' },
    });

    // 예약 가능한 일정만 반환
    const result: ConcertSchedule[] = [];
    for (const schedule of schedules) {
      const availableCount = await this.seatRepository.count({
        where: { concertScheduleId: schedule.id, status: SeatStatus.AVAILABLE },
      });
      if (availableCount > 0) result.push(schedule);
    }
    return result;
  }

  /** 날짜별 예약 가능 좌석 조회 */
  async getAvailableSeats(concertScheduleId: number): Promise<Seat[]> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: concertScheduleId },
    });
    if (!schedule) throw new NotFoundException('일정을 찾을 수 없습니다.');

    // 만료된 임시 예약 좌석 해제
    await this.releaseExpiredTempReservations();

    return this.seatRepository.find({
      where: { concertScheduleId, status: SeatStatus.AVAILABLE },
      order: { seatNumber: 'ASC' },
    });
  }

  /** Expire temp reservations whose time has passed */
  async releaseExpiredTempReservations(): Promise<void> {
    await this.seatRepository
      .createQueryBuilder()
      .update(Seat)
      .set({
        status: SeatStatus.AVAILABLE,
        tempReservedUntil: null,
        tempReservedUserId: null,
      })
      .where('status = :status AND tempReservedUntil < :now', {
        status: SeatStatus.TEMP_RESERVED,
        now: new Date(),
      })
      .execute();
  }

  async getSeat(seatId: number): Promise<Seat> {
    const seat = await this.seatRepository.findOne({ where: { id: seatId } });
    if (!seat) throw new NotFoundException('좌석을 찾을 수 없습니다.');
    return seat;
  }

  async findSeatByScheduleAndNumber(
    concertScheduleId: number,
    seatNumber: number,
  ): Promise<Seat | null> {
    return this.seatRepository.findOne({ where: { concertScheduleId, seatNumber } });
  }
}
