import dotenv from 'dotenv';
import { z } from 'zod';

// Load once, before anything else reads env.
// server.ts previously called dotenv.config per-request factory;
// index.ts is now the single entry point, but importing this module
// directly also guarantees variables are present (e.g. in tests that
// import services without going through createServer()).
dotenv.config({
  path: process.env.NODE_ENV?.trim() === 'test' ? '.env.test' : '.env',
});

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  TRANSFORMERS_REDIS_URL: z.string().min(1, 'TRANSFORMERS_REDIS_URL is required'),
  OTP_REDIS_URL: z.string().min(1, 'OTP_REDIS_URL is required'),
  TRANSFORMERS_STREAM: z.string().default('images'),
  OTP_STREAM: z.string().default('otps'),
  INTERNAL_OTP_URL: z.string().min(1, 'INTERNAL_OTP_URL is required'),
  INTERNAL_OTP_ENDPOINT: z.string().min(1, 'INTERNAL_OTP_ENDPOINT is required'),
  S3_BUCKETNAME: z.string().min(1, 'S3_BUCKETNAME is required'),
  S3_ENDPOINT: z.string().min(1, 'S3_ENDPOINT is required'),
  S3_ACCESSKEYID: z.string().min(1, 'S3_ACCESSKEYID is required'),
  S3_SECRETACCESSKEY: z.string().min(1, 'S3_SECRETACCESSKEY is required'),
  S3_DEFAULT_KEY: z.string().min(1, 'S3_DEFAULT_KEY is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be 32+ characters'),
  COOKIE_PRIVATE_KEY: z.string().min(16, 'COOKIE_PRIVATE_KEY must be 16+ characters'),
  JWT_PRIVATE_KEY: z.string().min(16, 'JWT_PRIVATE_KEY must be 16+ characters'),
  MENUCHI_FRONT_URL: z.string().default('http://localhost:3000'),
});

export type Env = z.infer<typeof schema>;

// Lazy accessor so tests can set process.env before first use,
// while production fails fast with a readable zod message.
let cached: Env | undefined;

export function getEnv(): Env {
  if (!cached) {
    cached = schema.parse(process.env);
  }
  return cached;
}

// Eager export for convenient `import { env } from './env'` usage.
// Throws on import when required vars are missing — intentional fail-fast.
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string | symbol) {
    return (getEnv() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export function resetEnvCache(): void {
  cached = undefined;
}
