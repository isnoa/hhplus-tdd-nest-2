import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  IConcertScheduleRepositoryPort,
  ConcertScheduleData,
} from "../../core/application/ports/concert-schedule-repository.port";
import { ConcertSchedule } from "../../../concert/entities/concert-schedule.entity";

/**
 * ConcertScheduleRepositoryAdapter
 * ConcertSchedule 데이터베이스를 통해 콘서트 일정 데이터에 접근하는 Adapter
 */
@Injectable()
export class ConcertScheduleRepositoryAdapter
  implements IConcertScheduleRepositoryPort
{
  constructor(
    @InjectRepository(ConcertSchedule)
    private readonly scheduleRepository: Repository<ConcertSchedule>,
  ) {}

  async getSchedule(scheduleId: number): Promise<ConcertScheduleData | null> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id: scheduleId },
    });

    if (!schedule) return null;

    return {
      id: schedule.id,
      price: schedule.price,
      totalSeats: schedule.totalSeats,
      // availableSeats는 엔티티에 존재하지 않으므로 totalSeats로 대체
      availableSeats: schedule.totalSeats,
    };
  }
}
