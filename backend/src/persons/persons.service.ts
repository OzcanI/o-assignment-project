import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { formatCents } from '../common/money/money.js';
import { Person } from './person.entity.js';

export interface PersonResponse {
  id: string;
  name: string;
  balance: string;
}

export const toPersonResponse = (person: Person): PersonResponse => ({
  id: person.id,
  name: person.name,
  balance: formatCents(person.balance),
});

@Injectable()
export class PersonsService {
  constructor(@InjectRepository(Person) private readonly persons: Repository<Person>) {}

  findAll(): Promise<Person[]> {
    return this.persons.find({ order: { name: 'ASC', id: 'ASC' } });
  }
}
