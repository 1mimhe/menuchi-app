import { RedisClientType } from 'redis';
import { createRedisClient } from './redisFactory';

let instance: RedisClientType | undefined;

/** Lazy accessor — prefer over the default export in new code. */
export function getRedisClient(): RedisClientType {
  if (!instance) {
    instance = createRedisClient(process.env.REDIS_URL, 'Session');
    instance.connect();
  }
  return instance;
}

// TODO(Phase-3): migrate imports to getRedisClient() and drop import-time connect.
export default getRedisClient();
