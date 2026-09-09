import { Prisma } from '@prisma/client';

/**
 * Retries position-assigning transactions on unique violations (Phase-2).
 * `max+1` position reads race under concurrency; the matching `@@unique`
 * constraints in schema.prisma turn a silent duplicate into P2002, and this
 * helper recomputes from scratch (whole $transaction rolls back on throw,
 * so retries are side-effect free). Caps at 3 attempts, then rethrows.
 */
export async function withUniqueRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
