import { Controller, Get } from '@nestjs/common';
import { BankService, toBankBalancePayload, type BankBalancePayload } from './bank.service.js';

@Controller('bank')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  @Get()
  async get(): Promise<BankBalancePayload> {
    return toBankBalancePayload(await this.bankService.getBank());
  }
}
