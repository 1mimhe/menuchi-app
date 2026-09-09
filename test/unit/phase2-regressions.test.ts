import { describe, expect, test, vi } from 'vitest';
import { ValidateError } from 'tsoa';
import { Prisma } from '@prisma/client';
import { canAccess } from '../../src/auth/permissionGuard';
import {
  applySessionUpdate,
  removeBranchFromSession,
  removeMenuFromSession,
  removeRestaurantFromSession,
} from '../../src/auth/sessionSync';
import { PermissionScope, SessionUpdateScope } from '../../src/types/Enums';
import { UserSession } from '../../src/types/AuthTypes';
import { isForeignKeyViolation, isRecordNotFound } from '../../src/utils/prismaErrors';
import { errorPreprocessor, notFoundHandler } from '../../src/middlewares/ErrorHandler';
import MenuchiError from '../../src/exceptions/MenuchiError';
import { CylinderValidationError } from '../../src/exceptions/ValidationError';
import { DashboardService } from '../../src/services/DashboardService';
import { OrderService } from '../../src/services/OrderService';
import { ItemNotFound } from '../../src/exceptions/NotFoundError';
import { withUniqueRetry } from '../../src/utils/positionRetry';

function knownError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('permissionGuard', () => {
  const user: UserSession = {
    id: 'u1',
    restaurants: [{ id: 'r1', branches: [{ id: 'b1', backlogId: 'bl1', menus: ['m1'] }] }],
  };

  test('grants own restaurant/branch/backlog/menu', () => {
    expect(canAccess(user, PermissionScope.Restaurant, 'r1')).toBe(true);
    expect(canAccess(user, PermissionScope.Branch, 'b1')).toBe(true);
    expect(canAccess(user, PermissionScope.Backlog, 'bl1')).toBe(true);
    expect(canAccess(user, PermissionScope.Menu, 'm1')).toBe(true);
  });

  test('denies foreign ids, unknown scope and missing user', () => {
    expect(canAccess(user, PermissionScope.Restaurant, 'rX')).toBe(false);
    expect(canAccess(user, PermissionScope.Branch, 'bX')).toBe(false);
    expect(canAccess(user, PermissionScope.Backlog, 'blX')).toBe(false);
    expect(canAccess(user, PermissionScope.Menu, 'mX')).toBe(false);
    expect(canAccess(user, undefined, 'r1')).toBe(false);
    expect(canAccess(undefined, PermissionScope.Restaurant, 'r1')).toBe(false);
  });
});

describe('sessionSync', () => {
  test('dedupes repeat pushes', () => {
    const userSession: UserSession = { id: 'u1', restaurants: [] };
    const update = {
      userSession,
      restaurantId: 'r1',
      branch: { id: 'b1', backlogId: 'bl1' },
    } as const;
    applySessionUpdate(SessionUpdateScope.Restaurant, update as never);
    applySessionUpdate(SessionUpdateScope.Restaurant, update as never);
    expect(userSession.restaurants).toHaveLength(1);

    applySessionUpdate(SessionUpdateScope.Menu, {
      userSession,
      restaurantId: 'r1',
      branchId: 'b1',
      menuId: 'm1',
    } as never);
    applySessionUpdate(SessionUpdateScope.Menu, {
      userSession,
      restaurantId: 'r1',
      branchId: 'b1',
      menuId: 'm1',
    } as never);
    expect(userSession.restaurants?.[0].branches[0].menus).toEqual(['m1']);
  });

  test('removals mirror deletions', () => {
    const userSession: UserSession = {
      id: 'u1',
      restaurants: [{ id: 'r1', branches: [{ id: 'b1', backlogId: 'bl1', menus: ['m1'] }] }],
    };
    removeMenuFromSession(userSession, 'r1', 'b1', 'm1');
    expect(userSession.restaurants?.[0].branches[0].menus).toEqual([]);
    removeBranchFromSession(userSession, 'r1', 'b1');
    expect(userSession.restaurants?.[0].branches).toEqual([]);
    removeRestaurantFromSession(userSession, 'r1');
    expect(userSession.restaurants).toEqual([]);
  });
});

describe('prismaErrors', () => {
  test('P2025 is record-not-found, other codes are not', () => {
    expect(isRecordNotFound(knownError('P2025'))).toBe(true);
    expect(isRecordNotFound(knownError('P2002'))).toBe(false);
    expect(isRecordNotFound(new Error('An operation failed because ... not found'))).toBe(false);
  });

  test('P2003 matches constraint names', () => {
    const err = knownError('P2003', { field_name: 'cylinders_menu_id_fkey (index)' });
    expect(isForeignKeyViolation(err, 'cylinders_menu_id_fkey')).toBe(true);
    expect(isForeignKeyViolation(err, 'menus_branch_id_fkey')).toBe(false);
    expect(isForeignKeyViolation(knownError('P2002'), 'cylinders_menu_id_fkey')).toBe(false);
    expect(isForeignKeyViolation(err)).toBe(true);
  });

  test('P2003 matches Prisma 6 meta.constraint shape', () => {
    const err = knownError('P2003', {
      modelName: 'Branch',
      constraint: 'branches_restaurant_id_fkey',
    });
    expect(isForeignKeyViolation(err, 'branches_restaurant_id_fkey')).toBe(true);
    expect(isForeignKeyViolation(err, 'menus_branch_id_fkey')).toBe(false);
    expect(isForeignKeyViolation(err)).toBe(true);
  });
});

describe('errorPreprocessor', () => {
  const next = () => vi.fn();
  const req = (path: string) => ({ path }) as never;

  test('forwards MenuchiError untouched via next (never throws)', () => {
    const err = new MenuchiError('x', 400);
    const n = next();
    expect(() => errorPreprocessor(err, req('/x'), {} as never, n)).not.toThrow();
    expect(n).toHaveBeenCalledWith(err);
  });

  test('maps menu cylinder validation path to CylinderValidationError (not Menu)', () => {
    const err = new ValidateError({ day: { message: 'invalid', value: 1 } }, 'bad');
    const n = next();
    errorPreprocessor(err, req('/menus/1/cylinders'), {} as never, n);
    expect(n).toHaveBeenCalledOnce();
    expect(n.mock.calls[0][0]).toBeInstanceOf(CylinderValidationError);
  });

  test('wraps unknown errors as 500', () => {
    const n = next();
    errorPreprocessor(new Error('boom'), req('/x'), {} as never, n);
    const forwarded = n.mock.calls[0][0] as MenuchiError;
    expect(forwarded).toBeInstanceOf(MenuchiError);
    expect(forwarded.status).toBe(500);
  });
});

describe('notFoundHandler', () => {
  test('returns 404 JSON for unknown routes', () => {
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    notFoundHandler({ path: '/nope' } as never, { status } as never, (() => {}) as never);
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

describe('DashboardService.getDayItems (B1)', () => {
  test('returns flattened items sorted by orderCount with resolved picUrls', async () => {
    const item = (id: string, orderCount: number, picKey: string | null) => ({
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      picKey,
      name: id,
      ingredients: '',
      price: 10,
      isActive: true,
      orderCount,
    });
    const menuCategory = (categoryId: string, items: ReturnType<typeof item>[]) => ({
      categoryId,
      category: { categoryNameId: 'cn1', categoryName: { name: 'Cat' } },
      items,
    });
    const mockPrisma = {
      restaurant: {
        findMany: async () => [
          {
            branches: [
              {
                menus: [
                  { cylinders: [{ menuCategories: [menuCategory('c1', [item('low', 1, null)])] }] },
                ],
              },
            ],
          },
          {
            branches: [
              {
                menus: [
                  {
                    cylinders: [{ menuCategories: [menuCategory('c2', [item('high', 9, 'k1')])] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    } as never;
    const s3 = {
      generateGetPresignedUrl: async (k: string | null) => (k ? `signed:${k}` : null),
      generatePutPresignedUrl: async (k: string) => `signed:${k}`,
    };

    const items = await new DashboardService(mockPrisma, s3).getDayItems('u1');
    expect(items).toHaveLength(2);
    expect(items[0].id).toBe('high');
    expect(items[0].picUrl).toBe('signed:k1');
    expect(items[1].picUrl).toBeNull();
  });
});

describe('OrderService.createOrder (B3)', () => {
  test('rejects partial item-id matches', async () => {
    const tx = {
      item: { findMany: async () => [{ id: 'i1', price: 100 }] },
      order: { create: vi.fn() },
    };
    const prisma = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as never;
    const s3 = {
      generateGetPresignedUrl: async () => null,
      generatePutPresignedUrl: async (k: string) => `signed:${k}`,
    };

    await expect(
      new OrderService(prisma, s3).createOrder('a@b.c', 'm1', {
        items: [
          { itemId: 'i1', amount: 1 },
          { itemId: 'missing', amount: 1 },
        ],
      } as never)
    ).rejects.toThrowError(ItemNotFound);
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  test('prices the full match correctly', async () => {
    const create = vi.fn(async (args: { data: { totalPrice: number } }) => ({
      id: 'o1',
      totalPrice: args.data.totalPrice,
      orderItems: [{ item: { name: 'Burger', picKey: 'k1' }, amount: 2, price: 100 }],
    }));
    const tx = {
      item: { findMany: async () => [{ id: 'i1', price: 100 }] },
      order: { create },
    };
    const prisma = { $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as never;
    const s3 = {
      generateGetPresignedUrl: async (k: string | null) => (k ? `signed:${k}` : null),
      generatePutPresignedUrl: async (k: string) => `signed:${k}`,
    };

    const order = await new OrderService(prisma, s3).createOrder('a@b.c', 'm1', {
      items: [{ itemId: 'i1', amount: 2 }],
    } as never);
    expect(create.mock.calls[0][0].data.totalPrice).toBe(200);
    expect(order.orderItems?.[0]).toMatchObject({ pikUrl: 'signed:k1' });
  });
});

describe('withUniqueRetry', () => {
  test('retries P2002 then returns', async () => {
    let calls = 0;
    const result = await withUniqueRetry(async () => {
      calls++;
      if (calls < 3) throw knownError('P2002');
      return 'ok';
    });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });

  test('rethrows non-unique errors immediately', async () => {
    const boom = new Error('boom');
    await expect(
      withUniqueRetry(async (): Promise<string> => {
        throw boom;
      })
    ).rejects.toBe(boom);
  });

  test('throws last P2002 after exhausting attempts', async () => {
    const p2002 = knownError('P2002');
    let calls = 0;
    await expect(
      withUniqueRetry(async (): Promise<string> => {
        calls++;
        throw p2002;
      }, 2)
    ).rejects.toBe(p2002);
    expect(calls).toBe(2);
  });
});
