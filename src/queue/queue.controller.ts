import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueTokenDto } from './dto/create-queue-token.dto';

@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  /** 유저 대기열 토큰 발급 */
  @Post('token')
  issueToken(@Body() dto: CreateQueueTokenDto) {
    return this.queueService.issueToken(dto);
  }

  /** 대기열 상태 조회 */
  @Get('token/:token/status')
  getQueueStatus(@Param('token') token: string) {
    return this.queueService.getQueueStatus(token);
  }
}
