import { Prisma } from '@prisma/client';

/**
 * Code-based Prisma error predicates (Phase-2).
 * Replaces fragile `error.message.includes('not found' | '*_fkey')` sniffing,
 * which breaks on Prisma upgrades / message rewording.
 *
 * - P2025: "An operation failed because it depends on one or more records
 *   that were required but not found." (findUniqueOrThrow / findFirstOrThrow)
 * - P2003: "Foreign key constraint failed." `meta.field_name` carries the
 *   constraint, e.g. `cylinders_menu_id_fkey (index)`.
 * - P2002: unique-constraint violation (handled generically as 409 upstream).
 */
export function isRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  );
}

export function isForeignKeyViolation(error: unknown, constraint?: string): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2003'
  ) {
    return false;
  }
  if (!constraint) return true;
  const meta = error.meta as { field_name?: unknown } | undefined;
  const field = typeof meta?.field_name === 'string' ? meta.field_name : '';
  return field.includes(constraint);
}
