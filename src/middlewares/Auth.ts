import { Request } from 'express';
import { CookieNames, RolesEnum } from '../types/Enums';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/AuthTypes';
import { ForbiddenError, InvalidTokenError, UnauthorizedError } from '../exceptions/AuthError';

export async function expressAuthentication(
  request: Request,
  _securityName: string,
  scopes?: string[]
): Promise<boolean> {
  const accessToken = request.cookies?.[CookieNames.AccessToken];

  if (!accessToken || !request.session?.accessToken) {
    throw new UnauthorizedError();
  }

  if (accessToken !== request.session.accessToken) {
    throw new UnauthorizedError();
  }

  let payload: JWTPayload;
  try {
    let secret: string;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getEnv } = require('../config/env') as typeof import('../config/env');
      secret = getEnv().JWT_PRIVATE_KEY;
    } catch {
      secret = process.env.JWT_PRIVATE_KEY as string;
    }
    payload = jwt.verify(accessToken, secret) as JWTPayload;
  } catch {
    throw new InvalidTokenError();
  }

  if (!payload?.userId || request.session.user?.id !== payload.userId) {
    throw new ForbiddenError();
  }

  if (scopes?.length) {
    const hasAccess = scopes.some((scope) => payload.roles?.includes(scope as RolesEnum));
    if (!hasAccess) throw new ForbiddenError();
  }

  request.session.lastAccessed = new Date();
  return true;
}
