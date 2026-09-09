import { ErrorDetail } from '../types/ErrorTypes';
import MenuchiError from './MenuchiError';

export class DatabaseError extends MenuchiError {
  constructor(
    message: string = 'Database error',
    status: number = 500,
    code?: number,
    details?: ErrorDetail[]
  ) {
    super(message, status, code, details);
  }
}

export class ConstraintsDatabaseError extends DatabaseError {
  constructor(details?: ErrorDetail[]) {
    super('Constraint failed', 409, 4090, details);
  }
}

export class ValidationDatabaseError extends DatabaseError {
  constructor(message: string) {
    super(message, 422);
  }
}
