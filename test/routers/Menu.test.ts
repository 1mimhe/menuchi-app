import { beforeAll, describe, expect, test, vi } from 'vitest';
import { CategoryNameController } from '../../src/controllers/CategoryNameController';
import { RestaurantController } from '../../src/controllers/RestaurantController';
import { BacklogController } from '../../src/controllers/BacklogController';
import BaseController from '../../src/controllers/BaseController';
import {
  returnCategoryName,
  returnCylinder,
  returnItem,
  returnMenu,
  returnRestaurant,
} from '../factories';
import { MenuController } from '../../src/controllers/MenuController';
import { CylinderValidationError } from '../../src/exceptions/ValidationError';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CylinderNotFound, MenuNotFound } from '../../src/exceptions/NotFoundError';
import MenuchiError from '../../src/exceptions/MenuchiError';
import { MenuCompactIn } from '../../src/types/MenuTypes';
import { getMenuService } from '../../src/services/MenuService';
import { getBacklogService } from '../../src/services/BacklogService';

const menuService = getMenuService();
const backlogService = getBacklogService();

beforeAll(() => {
  // Phase-1 tech debt: direct controller calls bypass HTTP auth.
  // Mock guard here; real enforcement is covered via HTTP in AuthZ.test.ts.
  // TODO(Phase-3): convert these to Supertest and drop this mock.
  vi.spyOn(BaseController.prototype, 'checkPermission').mockImplementation(() => {});
});

const categoryNameController = new CategoryNameController();
const restaurantController = new RestaurantController();
const backlogController = new BacklogController();
const menuController = new MenuController();
const categoryNameObject = returnCategoryName();
const restaurantObject = returnRestaurant();
const itemObject = returnItem();
const menuObject = returnMenu();
const cylinderObject = returnCylinder();

describe('GET /menus/backlog/{backlogId}', () => {
  test('should retrieved backlog successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const backlog = await menuController.getBacklog(backlogId!);

    expect(backlog.id).toBe(backlogId);
    expect(backlog.categories?.[0]?.id).toBe(categoryId);
    expect(backlog.categories?.[0]?.items?.[0]).toMatchObject(itemObject);
  });

  test('should retrieved backlog with categories contain the search query param successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const backlog = await menuController.getBacklog(backlogId!, 'test');

    expect(backlog.id).toBe(backlogId);
    expect(backlog.categories?.[0]?.id).toBe(categoryId);
    expect(backlog.categories?.[0]?.categoryName).toContain('test');
    expect(backlog.categories?.[0]?.items?.[0]).toMatchObject(itemObject);

    // No category containing 'random' was found.
    const backlog2 = await menuController.getBacklog(backlogId!, 'random');
    expect(backlog2.categories?.length).toBe(0);
  });
});

describe('POST /menus', () => {
  test('should create menu successfully.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    const promise = menuController.createMenu({ ...menuObject, branchId });

    await expect(promise).resolves.toMatchObject({ ...menuObject, branchId });
  });
});

describe('GET /menus/branch/{branchId}', () => {
  test('should retrieved menus successfully.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    const menu = await menuController.createMenu({ ...menuObject, branchId });
    const menu2 = await menuController.createMenu({ ...menuObject, branchId });
    const promise = menuController.getAllMenus(branchId);

    await expect(promise).resolves.toMatchObject([menu, menu2]);
  });
});

describe('GET /menus/{menuId}', () => {
  test('should retrieved menu successfully.', async () => {
    const { id: categoryNameId1 } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: categoryNameId2 } =
      await categoryNameController.createCategoryName(returnCategoryName());
    const { id: categoryNameId3 } =
      await categoryNameController.createCategoryName(returnCategoryName());
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item1 = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId1,
      ...itemObject,
    });
    const item2 = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId2,
      ...itemObject,
    });
    const item3 = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId3,
      ...itemObject,
    });
    const menu = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const cylinder = await menuController.createCylinder(menu.id, cylinderObject);
    const menuCategory1 = await menuController.createMenuCategory(menu.id, {
      categoryId: item1.categoryId!,
      cylinderId: cylinder.id,
      items: [item1.id],
    });
    const menuCategory2 = await menuController.createMenuCategory(menu.id, {
      categoryId: item2.categoryId!,
      cylinderId: cylinder.id,
      items: [item2.id],
    });
    const menuCategory3 = await menuController.createMenuCategory(menu.id, {
      categoryId: item3.categoryId!,
      cylinderId: cylinder.id,
      items: [item3.id],
    });
    const promise = menuController.getMenu(menu.id);

    await expect(promise).resolves.toMatchObject({
      ...menu,
      cylinders: [
        {
          ...cylinder,
          days: [
            cylinder.sat,
            cylinder.sun,
            cylinder.mon,
            cylinder.tue,
            cylinder.wed,
            cylinder.thu,
            cylinder.fri,
          ],
          sat: undefined,
          sun: undefined,
          mon: undefined,
          tue: undefined,
          wed: undefined,
          thu: undefined,
          fri: undefined,
          menuCategories: [
            {
              ...menuCategory1,
              items: [{ ...itemObject, menuCategoryId: menuCategory1.id }],
            },
            {
              ...menuCategory2,
              items: [{ ...itemObject, menuCategoryId: menuCategory2.id }],
            },
            {
              ...menuCategory3,
              items: [{ ...itemObject, menuCategoryId: menuCategory3.id }],
            },
          ],
        },
      ],
    });
  });

  test('should rejects menu with MenuNotFound error.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    await menuController.createMenu({ ...menuObject, branchId });
    const promise = menuController.getMenu(randomUUID());

    await expect(promise).rejects.toThrowError(MenuNotFound);
  });
});

describe('PATCH /menus/{menuId}', () => {
  test('should update the menu successfully.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    const menu = await menuController.createMenu({ ...menuObject, branchId });
    const newMenu = {
      name: 'a new name',
      isPublished: true,
      favicon: '/key',
    } as MenuCompactIn;
    await menuController.updateMenu(menu.id, newMenu);
    const promise = menuService.getCompactMenu(menu.id);

    await expect(promise).resolves.toMatchObject(newMenu);
  });
});

describe('POST /menus/{menuId}/cylinders', () => {
  test('should create cylinder successfully.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId });
    const promise = menuController.createCylinder(menuId, cylinderObject);

    await expect(promise).resolves.toMatchObject(cylinderObject);
  });

  test('should rejects create cylinder with CylinderValidationError.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId });
    const promise = menuController.createCylinder(menuId, {}); // or with just false values.

    await expect(promise).rejects.toThrowError(CylinderValidationError);
  });

  test('should rejects create cylinder with constraint error.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId });
    await menuController.createCylinder(menuId, cylinderObject);
    const promise = menuController.createCylinder(menuId, cylinderObject);

    await expect(promise).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  test('should rejects create cylinder with MenuNotFound error.', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    await menuController.createMenu({ ...menuObject, branchId });
    const promise = menuController.createCylinder(randomUUID(), cylinderObject);

    await expect(promise).rejects.toThrowError(MenuNotFound);
  });
});

describe('PATCH /menus/{menuId}/cylinders', () => {
  test('should update cylinders order in menu successfully (204, null body).', async () => {
    const branchId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.id!;
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    const { id: cylinderId2 } = await menuController.createCylinder(menuId, { sat: true });
    const { id: cylinderId3 } = await menuController.createCylinder(menuId, { sun: true });
    const promise = menuController.reorderCylinders(menuId, [cylinderId3, cylinderId2, cylinderId]);

    await expect(promise).resolves.toBeNull();
  });
});

describe('POST /menus/{menuId}/categories', () => {
  test('should create menu category successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    const promise = menuController.createMenuCategory(menuId, {
      categoryId: item.categoryId!,
      cylinderId,
      items: [item.id],
    });

    await expect(promise).resolves.toMatchObject({
      categoryId: item.categoryId!,
      cylinderId,
    });
  });

  test('should rejects create menu category with constraint error.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    await menuController.createMenuCategory(menuId, {
      categoryId: item.categoryId!,
      cylinderId,
      items: [item.id],
    });
    const promise = menuController.createMenuCategory(menuId, {
      categoryId: item.categoryId!,
      cylinderId,
      items: [item.id],
    });

    await expect(promise).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });

  test('should rejects create menu category with MenuchiError error (invalid item ids).', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    const promise = menuController.createMenuCategory(menuId, {
      categoryId: item.categoryId!,
      cylinderId,
      items: [randomUUID()],
    });

    await expect(promise).rejects.toThrowError(MenuchiError);
    await expect(promise).rejects.toThrow('All item IDs must belong to the specified category.');
  });

  test('should rejects create menu category with MenuNotFound error.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    const promise = menuController.createMenuCategory(randomUUID(), {
      categoryId: item.categoryId!,
      cylinderId,
      items: [item.id],
    });

    await expect(promise).rejects.toThrowError(MenuNotFound);
  });

  test('should rejects create menu category with CylinderNotFound error.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    await menuController.createCylinder(menuId, cylinderObject);
    const promise = menuController.createMenuCategory(menuId, {
      categoryId: item.categoryId!,
      cylinderId: randomUUID(),
      items: [item.id],
    });

    await expect(promise).rejects.toThrowError(CylinderNotFound);
  });

  test('should rejects create menu category with MenuchiError error (invalid category id).', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    const promise = menuController.createMenuCategory(menuId, {
      categoryId: randomUUID(),
      cylinderId,
      items: [item.id],
    });

    await expect(promise).rejects.toThrowError(MenuchiError);
    await expect(promise).rejects.toThrow('All item IDs must belong to the specified category.');
  });
});

describe('PATCH /menus/{menuId}/categories', () => {
  test('should update categories order in menu successfully and return number of updated categories.', async () => {
    const { id: categoryNameId1 } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: categoryNameId2 } =
      await categoryNameController.createCategoryName(returnCategoryName());
    const { id: categoryNameId3 } =
      await categoryNameController.createCategoryName(returnCategoryName());
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const item1 = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId1,
      ...itemObject,
    });
    const item2 = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId2,
      ...itemObject,
    });
    const item3 = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId3,
      ...itemObject,
    });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    const { id: menuCategoryId1 } = await menuController.createMenuCategory(menuId, {
      categoryId: item1.categoryId!,
      cylinderId,
      items: [item1.id],
    });
    const { id: menuCategoryId2 } = await menuController.createMenuCategory(menuId, {
      categoryId: item2.categoryId!,
      cylinderId,
      items: [item2.id],
    });
    const { id: menuCategoryId3 } = await menuController.createMenuCategory(menuId, {
      categoryId: item3.categoryId!,
      cylinderId,
      items: [item3.id],
    });
    const promise = menuController.reorderMenuCategories(menuId, [
      menuCategoryId3,
      menuCategoryId2,
      menuCategoryId1,
    ]);

    await expect(promise).resolves.toBeNull();
  });
});

describe('PATCH /menus/{menuId}/items', () => {
  test('should update items order in menu category successfully (204, null body).', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const { id: itemId1, categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const { id: itemId2 } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const { id: itemId3 } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    await menuController.createMenuCategory(menuId, {
      categoryId: categoryId!,
      cylinderId,
      items: [itemId1, itemId2, itemId3],
    });
    const promise = menuController.reorderMenuItems(menuId, [itemId3, itemId2, itemId1]);

    await expect(promise).resolves.toBeNull();
  });
});

describe('PATCH /menus/{menuId}/items/{menuItemId}/hide/{isHide}', () => {
  test('should hide item in menu successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const { id: itemId, categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId,
      ...itemObject,
    });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    await menuController.createMenuCategory(menuId, {
      categoryId: categoryId!,
      cylinderId,
      items: [itemId],
    });
    await menuController.hideMenuItem(menuId, itemId, true);
    const { isActive } = await backlogService.getItem(itemId);

    expect(isActive).toBe(false);
  });
});

describe('DELETE /menus/{menuId}/items', () => {
  test('should delete items in menu successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: backlogId, branchId } = (
      await restaurantController.createRestaurant(restaurantObject)
    )?.branches?.[0]?.backlog!;
    const { id: itemId, categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId,
      ...itemObject,
    });
    const { id: menuId } = await menuController.createMenu({ ...menuObject, branchId: branchId! });
    const { id: cylinderId } = await menuController.createCylinder(menuId, cylinderObject);
    const { id: menuCategoryId } = await menuController.createMenuCategory(menuId, {
      categoryId: categoryId!,
      cylinderId,
      items: [itemId],
    });
    await menuController.deleteMenuItems(menuId, [itemId]);
    const menuCategory = await menuService.getMenuCategory(menuCategoryId);

    expect(menuCategory.items.some((item: { id?: string }) => item.id === itemId)).toBe(false);
  });
});

// TODO: test DELETE /menus/{menuId}/categories
// TODO: test previews
// TODO: test day items
