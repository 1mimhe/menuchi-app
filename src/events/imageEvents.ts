import { RedisClientType } from 'redis';
import { SyncOperations } from '../types/Enums';

export type ImageEvent = {
  image_key: string;
  operation: SyncOperations;
};

/**
 * Redis-Streams publisher extracted from BaseController.
 * Takes the client as a parameter instead of importing a singleton,
 * so services/controllers are testable without a live Redis.
 */
export async function publishImageEvent(
  client: Pick<RedisClientType, 'xAdd'>,
  streamName: string,
  key: string | null | undefined,
  operation: SyncOperations | undefined,
  _oldKey?: string | null
): Promise<void> {
  if (!key || !operation) return;
  const event: ImageEvent = { image_key: key, operation };
  await client.xAdd(streamName, '*', event);
}
