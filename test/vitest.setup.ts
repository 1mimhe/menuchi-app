import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import prisma from '../src/db/prisma';
import RedisClient from '../src/config/RedisClient';
import { execSync } from 'child_process';

execSync('npm run db-push');

afterEach(async () => {
  await prisma.$transaction([
    prisma.user.deleteMany(),
    prisma.userProfile.deleteMany(),
    prisma.role.deleteMany(),
    prisma.categoryName.deleteMany(),
    prisma.category.deleteMany(),
    prisma.restaurant.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.backlog.deleteMany(),
    prisma.item.deleteMany()
  ]);

  await RedisClient.flushAll();
});

beforeAll(async () => {
  vi.mock('../src/config/TransformersRedisClient.ts', () => {
    return {
      default: {
        connect: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        xAdd: vi.fn(),
      }
    };
  });

  vi.mock('../src/config/OtpRedisClient.ts', () => {
    return {
      default: {
        connect: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        xAdd: vi.fn(),
        incr: vi.fn(async () => 1),
        expire: vi.fn(async () => 1),
        del: vi.fn(async () => 1),
      }
    };
  });
  
  vi.mock('../src/services/S3Service.ts', () => {
    return {
      default: {
        generateGetPresignedUrl: vi.fn(async (key) => Promise.resolve(key)),
      }
    };
  });

  await prisma.$connect();
});

afterAll(async () => {
  vi.resetAllMocks();
  await prisma.$disconnect();
});
