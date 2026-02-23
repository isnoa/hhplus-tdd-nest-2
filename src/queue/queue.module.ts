import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueToken } from './entities/queue-token.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';

@Module({
  imports: [TypeOrmModule.forFeature([QueueToken])],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService, TypeOrmModule],
})
export class QueueModule {}
