import { describe, expect, test, vi, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';
import { expressAuthentication } from '../../src/middlewares/Auth';
import { CookieNames, RolesEnum } from '../../src/types/Enums';
import { publishImageEvent } from '../../src/events/imageEvents';
import { SyncOperations } from '../../src/types/Enums';
import { errorPreprocessor } from '../../src/middlewares/ErrorHandler';
import { Prisma } from '@prisma/client';
import { ConstraintsDatabaseError } from '../../src/exceptions/DatabaseError';

const TEST_SECRET = 'test-jwt-private-key-1234567890';

beforeAll(() => {
  process.env.JWT_PRIVATE_KEY = TEST_SECRET;
  // Make validated-env path also work when other vars are absent:
  // getEnv() throws without full env, expressAuthentication falls back
  // to process.env.JWT_PRIVATE_KEY (see Auth.ts).
});

function sign(payload: object): string {
  return jwt.sign(payload, TEST_SECRET, { algorithm: 'HS256' });
}

function reqWith(token: string | undefined, session: unknown) {
  return {
    cookies: token ? { [CookieNames.AccessToken]: token } : {},
    session,
  } as never;
}

describe('expressAuthentication regressions (Phase-1)', () => {
  test('missing cookie → 401', async () => {
    await expect(
      expressAuthentication(reqWith(undefined, {}), '', [RolesEnum.RestaurantOwner])
    ).rejects.toMatchObject({ status: 401 });
  });

  test('tampered cookie (session mismatch) → 401', async () => {
    const real = sign({ userId: 'u1', roles: [RolesEnum.RestaurantOwner] });
    const req = reqWith('tampered-token', {
      accessToken: real,
      user: { id: 'u1' },
    });
    await expect(expressAuthentication(req, '', [RolesEnum.RestaurantOwner])).rejects.toMatchObject(
      { status: 401 }
    );
  });

  test('invalid JWT signature → 401', async () => {
    const bad = jwt.sign({ userId: 'u1', roles: [] }, 'wrong-secret');
    const req = reqWith(bad, { accessToken: bad, user: { id: 'u1' } });
    await expect(expressAuthentication(req, '', [RolesEnum.RestaurantOwner])).rejects.toMatchObject(
      { status: 401 }
    );
  });

  test('session user / payload mismatch → 403', async () => {
    const token = sign({ userId: 'u1', roles: [RolesEnum.RestaurantOwner] });
    const req = reqWith(token, { accessToken: token, user: { id: 'u2' } });
    await expect(expressAuthentication(req, '', [RolesEnum.RestaurantOwner])).rejects.toMatchObject(
      { status: 403 }
    );
  });

  test('wrong role → 403', async () => {
    const token = sign({ userId: 'u1', roles: [RolesEnum.RestaurantCustomer] });
    const req = reqWith(token, { accessToken: token, user: { id: 'u1' } });
    await expect(expressAuthentication(req, '', [RolesEnum.RestaurantOwner])).rejects.toMatchObject(
      { status: 403 }
    );
  });

  test('no scopes required → allows any authenticated role', async () => {
    const token = sign({ userId: 'u1', roles: [RolesEnum.RestaurantCustomer] });
    const req = reqWith(token, { accessToken: token, user: { id: 'u1' } });
    await expect(expressAuthentication(req, '')).resolves.toBe(true);
    const req2 = reqWith(token, { accessToken: token, user: { id: 'u1' } });
    await expect(expressAuthentication(req2, '', [])).resolves.toBe(true);
  });

  test('valid owner token → true and touches lastAccessed', async () => {
    const token = sign({ userId: 'u1', roles: [RolesEnum.RestaurantOwner] });
    const session = { accessToken: token, user: { id: 'u1' } };
    const req = reqWith(token, session);
    await expect(expressAuthentication(req, '', [RolesEnum.RestaurantOwner])).resolves.toBe(true);
    expect((session as { lastAccessed?: unknown }).lastAccessed).toBeDefined();
  });
});

describe('publishImageEvent (Phase-2 split)', () => {
  test('no-ops on missing key/operation', async () => {
    const client = { xAdd: vi.fn() };
    await publishImageEvent(client as never, 'images', null, SyncOperations.Created);
    await publishImageEvent(client as never, 'images', 'k', undefined);
    expect(client.xAdd).not.toHaveBeenCalled();
  });

  test('publishes image_key + operation', async () => {
    const client = { xAdd: vi.fn(async () => 'id') };
    await publishImageEvent(client as never, 'images', 'k1', SyncOperations.Created);
    expect(client.xAdd).toHaveBeenCalledWith(
      'images',
      '*',
      expect.objectContaining({ image_key: 'k1' })
    );
  });
});

describe('errorPreprocessor Prisma codes (Phase-2)', () => {
  test('P2002 unique violation → 409 ConstraintsDatabaseError', () => {
    const err = new Prisma.PrismaClientKnownRequestError('unique', {
      code: 'P2002',
      clientVersion: 'test',
      meta: { target: ['displayName'], modelName: 'Restaurant' },
    });
    const n = vi.fn();
    errorPreprocessor(err, { path: '/restaurants' } as never, {} as never, n);
    expect(n).toHaveBeenCalledOnce();
    expect(n.mock.calls[0][0]).toBeInstanceOf(ConstraintsDatabaseError);
    expect(n.mock.calls[0][0].status).toBe(409);
  });

  test('P2025 not found → 404', () => {
    const err = new Prisma.PrismaClientKnownRequestError('missing', {
      code: 'P2025',
      clientVersion: 'test',
    });
    const n = vi.fn();
    errorPreprocessor(err, { path: '/x' } as never, {} as never, n);
    expect(n.mock.calls[0][0].status).toBe(404);
  });
});
