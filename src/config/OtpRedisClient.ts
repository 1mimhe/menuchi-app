import { RedisClientType } from 'redis';
import { createRedisClient } from './redisFactory';

let instance: RedisClientType | undefined;

function resolveUrl(): string | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getEnv } = require('./env') as typeof import('./env');
    return getEnv().OTP_REDIS_URL;
  } catch {
    return process.env.OTP_REDIS_URL;
  }
}

/** Lazy accessor — prefer over the default export in new code. */
export function getOtpRedisClient(): RedisClientType {
  if (!instance) {
    instance = createRedisClient(resolveUrl(), 'Otp');
    void instance.connect().catch(() => undefined);
  }
  return instance;
}

// Lazy default export: no connection on import.
const lazy: RedisClientType = new Proxy({} as RedisClientType, {
  get(_target, prop) {
    const client = getOtpRedisClient() as unknown as Record<PropertyKey, unknown>;
    const value = client[prop as string];
    return typeof value === 'function'
      ? (value as (...args: unknown[]) => unknown).bind(client)
      : value;
  },
});

export default lazy;
