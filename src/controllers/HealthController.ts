import path from 'path';
import { Get, Route, Tags } from 'tsoa';
import prismaClient from '../db/prisma';
import { getRedisClient } from '../config/RedisClient';

/**
 * Works both under ts-node (src/controllers/*.ts) and compiled output
 * (build/src/controllers/*.js): package.json lives at the repo root.
 */
function readVersion(): string {
  const candidates = [
    path.resolve(__dirname, '../../package.json'),
    path.resolve(__dirname, '../../../package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ];
  for (const file of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pkg = require(file) as { version?: unknown };
      if (typeof pkg.version === 'string') return pkg.version;
    } catch {
      // try next candidate
    }
  }
  return 'unknown';
}

@Route()
@Tags('Health')
export class HealthController {
  /**
   * Liveness probe — always 200 when the process is running.
   * Used by Docker HEALTHCHECK and orchestrators.
   */
  @Get('/health')
  public async health(): Promise<{
    status: string;
    uptime: number;
    version: string;
  }> {
    return {
      status: 'ok',
      uptime: process.uptime(),
      version: readVersion(),
    };
  }

  /**
   * Readiness probe — 200 only when Postgres + Redis are reachable.
   */
  @Get('/ready')
  public async ready(): Promise<{ status: string }> {
    await prismaClient.$queryRaw`SELECT 1`;
    await getRedisClient().ping();
    return { status: 'ok' };
  }
}
