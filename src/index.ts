import './config/env';
import createServer from './server';
import { getEnv } from './config/env';
import { logger } from './lib/logger';
import prismaClient from './db/prisma';
import { getRedisClient } from './config/RedisClient';

const env = getEnv();
const app = createServer();

const server = app.listen(env.PORT, '0.0.0.0', () => {
  logger.info(`Listening on port ${env.PORT}.`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'shutting down');
  await new Promise<void>((resolve) => server.close(() => resolve()));
  try {
    await prismaClient.$disconnect();
  } catch (err) {
    logger.error({ err }, 'prisma disconnect failed');
  }
  try {
    await getRedisClient().quit();
  } catch (err) {
    logger.error({ err }, 'redis quit failed');
  }
  process.exit(0);
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
