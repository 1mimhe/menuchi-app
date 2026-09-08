import { createClient, RedisClientType } from 'redis';

/**
 * Shared factory for the three Redis connections (session, transformers, OTP).
 * Each caller keeps its own singleton via `getXClient()` in its config module;
 * this factory only removes the triplicated wiring.
 */
export function createRedisClient(url: string | undefined, label: string): RedisClientType {
  const client = createClient({ url: url as string });

  let reported = false;
  client.on('error', (err: Error) => {
    if (reported) return;
    reported = true;
    console.log(`${label} Redis Client Error.`, err.message);
  });
  client.once('connect', () => console.log(`${label} Redis Connected.`));

  return client as unknown as RedisClientType;
}
