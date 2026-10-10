import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './person.entity.js';
import { PersonsService } from './persons.service.js';
import { PersonsController } from './persons.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([Person])],
  providers: [PersonsService],
  controllers: [PersonsController],
  exports: [PersonsService],
})
export class PersonsModule {}
