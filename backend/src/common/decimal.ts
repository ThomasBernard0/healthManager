import { Prisma } from '../generated/prisma/client.js';

/** Prisma Decimal → number, for DTOs. */
export function num(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}
