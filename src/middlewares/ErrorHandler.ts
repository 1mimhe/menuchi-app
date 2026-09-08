import { NextFunction, Request, Response } from 'express';
import { ValidateError } from 'tsoa';
import { validationErrorCleaner } from '../utils/utils';
import {
  AddressValidationError,
  BranchValidationError,
  CategoryNameValidationError,
  CylinderValidationError,
  ItemValidationError,
  MenuCategoryValidationError,
  MenuValidationError,
  OpeningTimesValidationError,
  RestaurantValidationError,
  S3ValidationError,
  UserValidationError,
  ValidationError,
} from '../exceptions/ValidationError';
import MenuchiError from '../exceptions/MenuchiError';
import {
  ConstraintsDatabaseError,
  ValidationDatabaseError,
} from '../exceptions/DatabaseError';
import { ErrorDetail } from '../types/ErrorTypes';
import { Prisma } from '@prisma/client';
import { InvalidTokenError } from '../exceptions/AuthError';
import { JsonWebTokenError } from 'jsonwebtoken';
import { PrismaClientInitializationError } from '@prisma/client/runtime/library';

function mapValidateError(path: string, details: ErrorDetail[]): MenuchiError {
  // NOTE: specific segments first — generic '/menus' must come last because
  // menu sub-paths (e.g. /menus/{id}/cylinders) also contain it.
  if (path.includes('/address')) return new AddressValidationError(details);
  if (path.includes('/opening-times')) return new OpeningTimesValidationError(details);
  if (path.includes('/branches')) return new BranchValidationError(details);
  if (path.includes('/cylinders')) return new CylinderValidationError(details);
  if (path.includes('/menu-categories')) return new MenuCategoryValidationError(details);
  if (path.includes('/items')) return new ItemValidationError(details);
  if (path.includes('/s3')) return new S3ValidationError(details);
  if (path.includes('/auth')) return new UserValidationError(details);
  if (path.includes('/menus')) return new MenuValidationError(details);

  switch (path) {
    case '/restaurants':
      return new RestaurantValidationError(details);
    case '/category-names':
      return new CategoryNameValidationError(details);
    default:
      return new ValidationError(...[,,,], details);
  }
}

export function errorPreprocessor(
  error: Error,
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  // Express 4 error middleware must forward via next(), never throw.
  if (error instanceof MenuchiError) {
    next(error);
    return;
  }

  if (error instanceof PrismaClientInitializationError) {
    next(new MenuchiError('Can\'t reach database server.', 500));
    return;
  }

  if (error instanceof JsonWebTokenError) {
    next(new InvalidTokenError());
    return;
  }

  if (error instanceof ValidateError) {
    next(mapValidateError(req.path, validationErrorCleaner(error)));
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      next(new MenuchiError('Resource not found.', 404));
      return;
    }
    const field = `Fields [${
      error.meta?.target ?? error.meta?.field_name
    }] at ${error.meta?.modelName} model`;
    const lines = error.message.split('\n');
    const message = lines[lines.length - 1];

    const detail: ErrorDetail[] = [{ field, message }];
    next(new ConstraintsDatabaseError(detail));
    return;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    next(new ValidationDatabaseError(error.message));
    return;
  }

  next(new MenuchiError(error.message, 500));
}

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Safety net: anything reaching here that isn't a MenuchiError is a bug —
  // never leak internals, never crash on missing .status.
  const normalized = error instanceof MenuchiError
    ? error
    : new MenuchiError('Internal error.', 500);

  if (process.env.NODE_ENV?.trim() !== 'test')
    console.error(normalized);
  res.status(normalized.status).json({
    code: normalized.code,
    message: normalized.message,
    details: normalized.details,
  });
}

export function notFoundHandler(
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.path} not found.`,
  });
}
