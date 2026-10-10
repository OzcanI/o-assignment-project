import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  type PipeTransform,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/** Extracts the raw `Idempotency-Key` header; combine with {@link IdempotencyKeyPipe}. */
export const IdempotencyKey = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined =>
    ctx.switchToHttp().getRequest<Request>().header(IDEMPOTENCY_KEY_HEADER),
);

/** The key becomes the batch primary key (uuid), so anything else is rejected up front. */
@Injectable()
export class IdempotencyKeyPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    if (!isUUID(value, 'all')) {
      throw new BadRequestException('Idempotency-Key header must be a UUID');
    }
    return value.toLowerCase();
  }
}
