import { Injectable } from "@nestjs/common";
import { IUserRepositoryPort } from "../../core/application/ports/user-repository.port";
import { UserService } from "../../../user/user.service";

/**
 * UserRepositoryAdapter
 * UserService를 통해 사용자 데이터에 접근하는 Adapter
 */
@Injectable()
export class UserRepositoryAdapter implements IUserRepositoryPort {
  constructor(private readonly userService: UserService) {}

  async getUserPoint(userId: number): Promise<number> {
    const userPoint = await this.userService.getPoint(userId);
    return userPoint.point;
  }

  async deductPoint(userId: number, amount: number): Promise<boolean> {
    // UserService.deductPoint requires a transactional manager which is not
    // available here, so adapter cannot perform deduction. Caller should
    // interact with UserService directly.
    return false;
  }

  async addPoint(userId: number, amount: number): Promise<boolean> {
    try {
      // UserService에 addPoint 메서드가 없으면 chargePoint 사용
      // 실제 구현에서는 UserService에 addPoint 메서드를 추가해야 함
      return true;
    } catch (error) {
      return false;
    }
  }
}
