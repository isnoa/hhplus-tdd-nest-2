/**
 * ConcertScheduleRepository Port Interface
 * 콘서트 일정 관련 데이터에 접근하기 위한 외부 Port
 */
export interface ConcertScheduleData {
  id: number;
  price: number;
  totalSeats: number;
  availableSeats: number;
}

export interface IConcertScheduleRepositoryPort {
  getSchedule(scheduleId: number): Promise<ConcertScheduleData | null>;
}
