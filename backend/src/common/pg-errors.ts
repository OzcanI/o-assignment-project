import { QueryFailedError } from 'typeorm';

const UNIQUE_VIOLATION = '23505';

interface PgDriverError extends Error {
  code?: string;
  constraint?: string;
}

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const driverError = err.driverError as PgDriverError;
  return (
    driverError.code === UNIQUE_VIOLATION &&
    (constraint === undefined || driverError.constraint === constraint)
  );
}
