import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BankModule } from '../bank/bank.module.js';
import { Transaction } from './entities/transaction.entity.js';
import { TransactionBatch } from './entities/transaction-batch.entity.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionsController } from './transactions.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, TransactionBatch]), BankModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
})
export class TransactionsModule {}
