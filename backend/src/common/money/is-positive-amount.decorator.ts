import { registerDecorator, type ValidationOptions } from 'class-validator';
import { AMOUNT_REGEX, parseAmountToCents } from './money.js';

/** A decimal string (max 12 integer and 2 fraction digits) strictly greater than zero. */
export function IsPositiveAmount(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyName) => {
    registerDecorator({
      name: 'isPositiveAmount',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: `$property must be a decimal string greater than 0 with at most 12 integer and 2 fraction digits, e.g. "12.34"`,
        ...options,
      },
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && AMOUNT_REGEX.test(value) && parseAmountToCents(value) > 0n,
      },
    });
  };
}
