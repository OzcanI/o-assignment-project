import { Controller, Get } from '@nestjs/common';
import { PersonsService, toPersonResponse, type PersonResponse } from './persons.service.js';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  async findAll(): Promise<PersonResponse[]> {
    return (await this.personsService.findAll()).map(toPersonResponse);
  }
}
