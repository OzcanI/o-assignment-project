import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration.js';
import { typeOrmOptionsFactory } from './config/database.config.js';
import { PersonsModule } from './persons/persons.module.js';
import { BankModule } from './bank/bank.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { SeedModule } from './seed/seed.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmOptionsFactory,
    }),
    PersonsModule,
    BankModule,
    TransactionsModule,
    SeedModule,
  ],
})
export class AppModule {}
