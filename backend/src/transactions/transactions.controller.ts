import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { CreateTransactionsDto } from './dto/create-transactions.dto.js';
import { ListTransactionsQuery } from './dto/list-transactions.query.js';
import { IdempotencyKey, IdempotencyKeyPipe } from './idempotency-key.js';
import { toTransactionPayload, type TransactionPayload } from './transaction.mapper.js';
import { TransactionsService, type BatchResponse } from './transactions.service.js';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  /**
   * Processes a batch of transfers in parallel. Responds 200 whenever the batch
   * was processed, even if items failed; outcomes are reported per item.
   * 400: invalid body or Idempotency-Key. 422: key reused with a different payload.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  process(
    @Body() dto: CreateTransactionsDto,
    @IdempotencyKey(new IdempotencyKeyPipe()) idempotencyKey?: string,
  ): Promise<BatchResponse> {
    return this.transactionsService.processBatch(dto, idempotencyKey);
  }

  @Get()
  async list(@Query() query: ListTransactionsQuery): Promise<TransactionPayload[]> {
    return (await this.transactionsService.findRecent(query.limit)).map(toTransactionPayload);
  }
}
