import { RedisClientType } from 'redis';
import { createRedisClient } from './redisFactory';

let instance: RedisClientType | undefined;

/** Lazy accessor — prefer over the default export in new code. */
export function getTransformersRedisClient(): RedisClientType {
  if (!instance) {
    instance = createRedisClient(process.env.TRANSFORMERS_REDIS_URL, 'Transformers');
    instance.connect();
  }
  return instance;
}

// TODO(Phase-3): migrate imports to getTransformersRedisClient() and drop import-time connect.
export default getTransformersRedisClient();
