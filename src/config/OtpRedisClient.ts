import { RedisClientType } from 'redis';
import { createRedisClient } from './redisFactory';

let instance: RedisClientType | undefined;

/** Lazy accessor — prefer over the default export in new code. */
export function getOtpRedisClient(): RedisClientType {
  if (!instance) {
    instance = createRedisClient(process.env.OTP_REDIS_URL, 'Otp');
    instance.connect();
  }
  return instance;
}

// TODO(Phase-3): migrate imports to getOtpRedisClient() and drop import-time connect.
export default getOtpRedisClient();
