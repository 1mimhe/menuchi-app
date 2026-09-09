import { afterAll, afterEach, beforeAll, vi } from 'vitest';

// Hoisted mocks (must be top-level for vitest hoisting to work reliably).
vi.mock('../src/config/TransformersRedisClient', () => ({
  getTransformersRedisClient: vi.fn(() => ({
    connect: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    xAdd: vi.fn(async () => 'mock-id'),
  })),
  default: {
    connect: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    xAdd: vi.fn(async () => 'mock-id'),
  },
}));

vi.mock('../src/config/OtpRedisClient', () => ({
  getOtpRedisClient: vi.fn(() => ({
    connect: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    xAdd: vi.fn(async () => 'mock-id'),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
  })),
  default: {
    connect: vi.fn(),
    on: vi.fn(),
    once: vi.fn(),
    xAdd: vi.fn(async () => 'mock-id'),
    incr: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
  },
}));

vi.mock('../src/services/S3Service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/S3Service')>();
  const mock = {
    generateGetPresignedUrl: vi.fn(async (key: string | null) => Promise.resolve(key)),
    generatePutPresignedUrl: vi.fn(async (key: string) => Promise.resolve(`signed:${key}`)),
  };
  return {
    ...actual,
    S3Service: actual.S3Service,
    getS3Service: vi.fn(() => mock),
  };
});

import prisma from '../src/db/prisma';
import { getRedisClient } from '../src/config/RedisClient';
import { execSync } from 'child_process';

function shouldManageDb(): boolean {
  // Unit-only runs (test/unit) set SKIP_DB=1 to avoid requiring Postgres.
  if (process.env.SKIP_DB === '1') return false;
  return Boolean(process.env.DATABASE_URL ?? process.env.DATABASE_URL_TEST ?? true);
}

beforeAll(async () => {
  if (!shouldManageDb()) return;
  try {
    execSync('npm run db-push', { stdio: 'ignore' });
  } catch {
    // Cold environments without Postgres still run pure unit tests.
  }
  try {
    await prisma.$connect();
  } catch {
    // Unit tests with mocked prisma do not need a live DB.
  }
});

afterEach(async () => {
  if (!shouldManageDb()) return;
  try {
    // FK-safe order: children first. Covers tables missed by the old
    // 9-table list (cylinder/menu/menuCategory/order/orderItem/address/openingTimes).
    await prisma.$transaction([
      prisma.orderItem.deleteMany(),
      prisma.order.deleteMany(),
      prisma.item.deleteMany(),
      prisma.menuCategory.deleteMany(),
      prisma.cylinder.deleteMany(),
      prisma.menu.deleteMany(),
      prisma.category.deleteMany(),
      prisma.backlog.deleteMany(),
      prisma.address.deleteMany(),
      prisma.openingTimes.deleteMany(),
      prisma.branch.deleteMany(),
      prisma.restaurant.deleteMany(),
      prisma.categoryName.deleteMany(),
      prisma.role.deleteMany(),
      prisma.userProfile.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  } catch {
    // No live DB — nothing to clean.
  }

  try {
    await getRedisClient().flushAll();
  } catch {
    // No live Redis — nothing to flush.
  }
});

afterAll(async () => {
  vi.resetAllMocks();
  try {
    await prisma.$disconnect();
  } catch {
    // Already disconnected / never connected.
  }
});
