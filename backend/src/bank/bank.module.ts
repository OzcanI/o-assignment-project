import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bank } from './bank.entity.js';
import { BankService } from './bank.service.js';
import { BankController } from './bank.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Bank])],
  providers: [BankService],
  controllers: [BankController],
  exports: [BankService],
})
export class BankModule {}
