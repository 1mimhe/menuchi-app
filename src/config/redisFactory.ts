import { createClient, RedisClientType } from 'redis';

/**
 * Shared factory for the three Redis connections (session, transformers, OTP).
 * Each caller keeps its own singleton via `getXClient()` in its config module;
 * this factory only removes the triplicated wiring.
 */
export function createRedisClient(url: string | undefined, label: string): RedisClientType {
  const client = createClient({ url: url as string });

  // Lazy logger import avoids a hard dependency cycle (logger reads env).
  const log = (...args: unknown[]): void => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logger } = require('../lib/logger') as typeof import('../lib/logger');
      (logger.info as (...a: unknown[]) => void)(...args);
    } catch {
      console.log(...args);
    }
  };

  let reported = false;
  client.on('error', (err: Error) => {
    if (reported) return;
    reported = true;
    log(`${label} Redis Client Error.`, err.message);
  });
  client.once('connect', () => log(`${label} Redis Connected.`));

  return client as unknown as RedisClientType;
}
