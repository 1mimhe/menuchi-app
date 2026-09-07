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
 * production uses the shared singletons below during the migration.
 * TODO: switch controllers to `req.app.locals.container` and drop
 * `export default new XService()` shims.
 */
export function createContainer(prisma: PrismaClient = prismaClient) {
  const s3 = new S3Service();
  return {
    prisma,
    s3,
    auth: new AuthService(prisma),
    backlog: new BacklogService(prisma),
    branch: new BranchService(prisma),
    categoryName: new CategoryNameService(prisma),
    dashboard: new DashboardService(prisma, s3),
    menu: new MenuService(prisma),
    order: new OrderService(prisma, s3),
    restaurant: new RestaurantService(prisma),
  };
}

export type Container = ReturnType<typeof createContainer>;
