import type { ValueTransformer } from 'typeorm';

/**
 * Maps Postgres `bigint` columns to JS `bigint`. The pg driver returns int8 as a
 * string precisely because `number` cannot represent the full range, so we never
 * go through `number`.
 */
export const bigintTransformer: ValueTransformer = {
  to: (value: bigint | null | undefined): string | null | undefined =>
    value === null || value === undefined ? value : value.toString(),
  from: (value: string | null): bigint | null =>
    value === null ? null : BigInt(value),
};
