import { PrismaClient } from '@prisma/client';
import prismaClient from './db/prisma';
import { AuthService } from './services/AuthService';
import { BacklogService } from './services/BacklogService';
import { BranchService } from './services/BranchService';
import { CategoryNameService } from './services/CategoryNameService';
import { DashboardService } from './services/DashboardService';
import { MenuService } from './services/MenuService';
import { OrderService } from './services/OrderService';
import { RestaurantService } from './services/RestaurantService';
import { S3Service } from './services/S3Service';

/**
 * Manual composition root (no DI framework — portfolio keeps it explicit).
 * Services are constructible with `new XService(prisma, s3)` in tests;
 * controllers resolve via `resolveContainer(req)` which prefers
 * `req.app.locals.container` (test override) and falls back to the
 * process-wide lazy singleton below. No `export default new XService()`
 * shims remain in `src/services/*`.
 */
export function createContainer(
  prisma: PrismaClient = prismaClient,
  s3?: import('./services/S3Service').PresignedUrlGenerator
) {
  const s3Service =
    s3 ??
    new S3Service(
      (() => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getEnv } = require('./config/env') as typeof import('./config/env');
          const e = getEnv();
          return {
            S3_ACCESSKEYID: e.S3_ACCESSKEYID,
            S3_SECRETACCESSKEY: e.S3_SECRETACCESSKEY,
            S3_ENDPOINT: e.S3_ENDPOINT,
            S3_BUCKETNAME: e.S3_BUCKETNAME,
          };
        } catch {
          return undefined;
        }
      })()
    );
  return {
    prisma,
    s3: s3Service,
    auth: new AuthService(prisma),
    backlog: new BacklogService(prisma, s3Service),
    branch: new BranchService(prisma),
    categoryName: new CategoryNameService(prisma),
    dashboard: new DashboardService(prisma, s3Service),
    menu: new MenuService(prisma, s3Service),
    order: new OrderService(prisma, s3Service),
    restaurant: new RestaurantService(prisma, s3Service),
  };
}

export type Container = ReturnType<typeof createContainer>;

let shared: Container | undefined;

/** Process-wide lazy container — no clients connect on import. */
export function getContainer(): Container {
  if (!shared) shared = createContainer();
  return shared;
}

/** Test hook: override the process container (e.g. with mocks). */
export function setContainerForTests(container: Container | undefined): void {
  shared = container;
}

/** Controller helper: prefers per-app override, falls back to singleton. */
export function resolveContainer(req?: {
  app?: { locals?: { container?: Container } };
}): Container {
  return req?.app?.locals?.container ?? getContainer();
}
