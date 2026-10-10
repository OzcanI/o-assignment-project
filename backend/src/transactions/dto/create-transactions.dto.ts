import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID, ValidateNested } from 'class-validator';
import { IsPositiveAmount } from '../../common/money/is-positive-amount.decorator.js';

export const MAX_BATCH_SIZE = 200;

export class TransactionItemDto {
  @IsUUID('all')
  personId: string;

  /** Decimal string such as "12.34"; strings avoid float rounding on the way in. */
  @IsPositiveAmount()
  amount: string;
}

export class CreateTransactionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_SIZE)
  @ValidateNested({ each: true })
  @Type(() => TransactionItemDto)
  transactions: TransactionItemDto[];
}
