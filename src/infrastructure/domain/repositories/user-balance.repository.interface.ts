/**
 * User Balance Repository Interface
 * 사용자 잔액(포인트) 관리를 위한 인터페이스
 */
export interface IUserBalanceRepository {
  /**
   * 사용자 잔액 조회
   */
  getBalance(userId: number): Promise<number>;

  /**
   * 잔액 차감 (결제)
   * @returns 성공 여부
   */
  deductBalance(userId: number, amount: number): Promise<boolean>;

  /**
   * 잔액 충전
   */
  chargeBalance(userId: number, amount: number): Promise<number>;

  /**
   * 잔액 충분한지 확인
   */
  hasSufficientBalance(userId: number, amount: number): Promise<boolean>;

  /**
   * 트랜잭션 기능: 잔액 직접 업데이트 (낙관적 락 활용)
   * @returns 업데이트 성공 여부
   */
  updateBalanceWithVersion(
    userId: number,
    amount: number,
    currentVersion: number,
  ): Promise<boolean>;

  /**
   * 사용자 버전/버전 번호 조회 (낙관적 락 용)
   */
  getVersionInfo(
    userId: number,
  ): Promise<{ version: number; point: number } | null>;
}
