/**
 * UserRepository Port Interface
 * 사용자 관련 데이터에 접근하기 위한 외부 Port
 */
export interface IUserRepositoryPort {
  getUserPoint(userId: number): Promise<number>;
  deductPoint(userId: number, amount: number): Promise<boolean>;
  addPoint(userId: number, amount: number): Promise<boolean>;
}
