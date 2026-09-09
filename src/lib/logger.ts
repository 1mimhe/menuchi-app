import pino from 'pino';

function resolveLevel(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnv } = require('../config/env') as typeof import('../config/env');
    return getEnv().LOG_LEVEL;
  } catch {
    return process.env.LOG_LEVEL ?? 'info';
  }
}

function isDevelopment(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnv } = require('../config/env') as typeof import('../config/env');
    return getEnv().NODE_ENV === 'development';
  } catch {
    return (process.env.NODE_ENV ?? 'development') === 'development';
  }
}

export const logger = pino({
  level: resolveLevel(),
  transport: isDevelopment() ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
});
