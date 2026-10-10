import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatCents } from '../common/money/money.js';
import { Bank, BANK_ID } from './bank.entity.js';

/** Wire format of GET /api/bank. */
export interface BankBalancePayload {
  /** Decimal string, e.g. "1234.56". */
  balance: string;
  /** bigint as a decimal string; compare with BigInt() on the client. */
  version: string;
  updatedAt: string;
}

export const toBankBalancePayload = (bank: Pick<Bank, 'balance' | 'version' | 'updatedAt'>): BankBalancePayload => ({
  balance: formatCents(bank.balance),
  version: bank.version.toString(),
  updatedAt: bank.updatedAt.toISOString(),
});

@Injectable()
export class BankService {
  constructor(@InjectRepository(Bank) private readonly bank: Repository<Bank>) {}

  async getBank(): Promise<Bank> {
    const bank = await this.bank.findOneBy({ id: BANK_ID });
    if (!bank) throw new NotFoundException('Bank has not been seeded yet');
    return bank;
  }
}
