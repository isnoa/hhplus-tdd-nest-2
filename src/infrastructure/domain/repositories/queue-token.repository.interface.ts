/**
 * Queue Token Repository Interface
 * 대기열 토큰 관리를 위한 인터페이스
 */
export interface IQueueTokenRepository {
  /**
   * 토큰 생성 및 저장
   */
  issueToken(userId: number, expiresAt: Date): Promise<string>;

  /**
   * 토큰으로 사용자 ID 조회
   */
  getUserIdByToken(token: string): Promise<number | null>;

  /**
   * 토큰 만료 확인
   */
  isTokenValid(token: string): Promise<boolean>;

  /**
   * 토큰 삭제
   */
  deleteToken(token: string): Promise<void>;

  /**
   * 만료된 토큰 정리
   */
  cleanupExpiredTokens(): Promise<number>;

  /**
   * 사용자의 활성 토큰 개수
   */
  getActiveTokenCount(userId: number): Promise<number>;
}
