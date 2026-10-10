import { createHash } from 'node:crypto';

export interface HashableItem {
  personId: string;
  amountCents: bigint;
}

/**
 * sha256 over a canonical representation of the batch: item order is
 * preserved (itemIndex is part of the identity), person ids are lowercased and
 * amounts are normalized to cents so "5", "5.0" and "5.00" hash the same.
 */
export function hashBatchRequest(items: readonly HashableItem[]): string {
  const canonical = JSON.stringify(
    items.map((item) => ({
      personId: item.personId.toLowerCase(),
      amountCents: item.amountCents.toString(),
    })),
  );
  return createHash('sha256').update(canonical).digest('hex');
}
