import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueueTokenGuard } from '../common/guards/queue-token.guard';
import { CurrentUserId } from '../common/decorators/current-user-id.decorator';

@Controller('payments')
@UseGuards(QueueTokenGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /** 결제 */
  @Post()
  processPayment(
    @CurrentUserId() userId: number,
    @Request() req: any,
    @Body() dto: CreatePaymentDto,
  ) {
    const queueToken: string = req.headers['x-queue-token'];
    return this.paymentService.processPayment(userId, queueToken, dto);
  }
}
