import { RedisClientType } from 'redis';
import { createRedisClient } from './redisFactory';

let instance: RedisClientType | undefined;

function resolveUrl(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnv } = require('./env') as typeof import('./env');
    return getEnv().REDIS_URL;
  } catch {
    return process.env.REDIS_URL;
  }
}

/** Lazy accessor — prefer over the default export in new code. */
export function getRedisClient(): RedisClientType {
  if (!instance) {
    instance = createRedisClient(resolveUrl(), 'Session');
    void instance.connect().catch(() => undefined);
  }
  return instance;
}

// Lazy default export: no connection on import. Property access
// initialises the singleton on first use, keeping existing
// `import RedisClient from './RedisClient'` call sites working.
const lazy: RedisClientType = new Proxy({} as RedisClientType, {
  get(_target, prop) {
    const client = getRedisClient() as unknown as Record<PropertyKey, unknown>;
    const value = client[prop as string];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export default lazy;
