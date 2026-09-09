import MenuchiError from './MenuchiError';

export class AuthError extends MenuchiError {
  constructor(message: string = 'Auth error', status: number = 400) {
    super(message, status);
  }
}

export class UnauthorizedError extends AuthError {
  constructor() {
    super('Unauthorized user.', 401);
  }
}

export class ForbiddenError extends AuthError {
  constructor() {
    super('Access Denied. You are not authorized to perform this action.', 403);
  }
}

export class InvalidTokenError extends AuthError {
  constructor() {
    super('Invalid token.', 401);
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Invalid credentials.', 401);
  }
}
