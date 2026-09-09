import { beforeAll, describe, expect, test, vi } from 'vitest';
import { CategoryNameController } from '../../src/controllers/CategoryNameController';
import { BacklogController } from '../../src/controllers/BacklogController';
import BaseController from '../../src/controllers/BaseController';
import { returnCategoryName, returnItem, returnRestaurant } from '../factories';
import { RestaurantController } from '../../src/controllers/RestaurantController';
import { randomUUID } from 'crypto';
import {
  BacklogNotFound,
  CategoryNameNotFound,
  CategoryNotFound,
  ItemNotFound,
} from '../../src/exceptions/NotFoundError';
import MenuchiError from '../../src/exceptions/MenuchiError';
import { getBacklogService } from '../../src/services/BacklogService';

const backlogService = getBacklogService();
import { Prisma } from '@prisma/client';

beforeAll(() => {
  // Phase-1 tech debt: direct controller calls bypass HTTP auth.
  // Mock guard here; real enforcement is covered via HTTP in AuthZ.test.ts.
  // TODO(Phase-3): convert these to Supertest and drop this mock.
  vi.spyOn(BaseController.prototype, 'checkPermission').mockImplementation(() => {});
});

const categoryNameController = new CategoryNameController();
const restaurantController = new RestaurantController();
const backlogController = new BacklogController();
const categoryNameObject = returnCategoryName();
const restaurantObject = returnRestaurant();
const itemObject = returnItem();

describe('POST /backlog/{backlogId}/items', () => {
  test('should create item successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const promise = backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });

    await expect(promise).resolves.toMatchObject(itemObject);
  });

  test("should assign items to the same categoryId with the same 'category name'. and auto-set their positionInCategory and positionInItemsList in ascending order.", async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const secondItem = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });

    expect(secondItem.categoryId).toBe(item.categoryId);
    expect(secondItem.positionInCategory! - item.positionInCategory!).toBe(1);
    expect(secondItem.positionInItemsList! - item.positionInItemsList!).toBe(1);
  });

  test('should rejects create item with BacklogNotFound.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const promise = backlogController.createItem(randomUUID(), { categoryNameId, ...itemObject });

    await expect(promise).rejects.toThrowError(BacklogNotFound);
  });

  test('should rejects create item with CategoryNameNotFound.', async () => {
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const promise = backlogController.createItem(backlogId!, {
      categoryNameId: randomUUID(),
      ...itemObject,
    });

    await expect(promise).rejects.toThrowError(CategoryNameNotFound);
  });
});

describe('GET /backlog/{backlogId}', () => {
  test('should retrieved backlog successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const backlog = await backlogController.getBacklog(backlogId!);

    expect(backlog.id).toBe(backlogId);
    expect(backlog.categories?.[0]?.id).toBe(categoryId);
    expect(backlog.categories?.[0]?.items?.[0]).toMatchObject(itemObject);
  });

  test('should rejects with BacklogNotFound.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const promise = backlogController.getBacklog(randomUUID());

    await expect(promise).rejects.toThrowError(BacklogNotFound);
  });
});

describe('GET /backlog/{backlogId}/items', () => {
  test('should retrieves items list successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const promise = backlogController.getItems(backlogId!);

    await expect(promise).resolves.toMatchObject([itemObject]);
  });

  test('should resolves with am empty array.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const promise = backlogController.getItems(randomUUID());

    await expect(promise).resolves.toMatchObject([]);
  });
});

describe('PATCH /backlog/{backlogId}/items/{itemId}', () => {
  test('should update the item successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const item = await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });

    const newItem = {
      name: 'new-item-name',
      price: 50000,
      ingredients: 'new-ingredients',
    };
    await backlogController.updateItem(backlogId!, item.id, newItem);
    const promise = backlogService.getItem(item.id);

    await expect(promise).resolves.not.toMatchObject(item);
    await expect(promise).resolves.toMatchObject(newItem);
  });
});

describe('PATCH /backlog/{backlogId}/reorder-items/in-category', () => {
  test('should update items order in category successfully (204, null body).', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { id: itemId1 } = await backlogController.createItem(backlogId!, {
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
    const promise = backlogController.reorderItemsInCategory(backlogId!, [
      itemId3,
      itemId2,
      itemId1,
    ]);

    // Controllers normalise reorder to 204/null (B7); the call succeeding
    // without a 23505 unique violation IS the regression assertion.
    await expect(promise).resolves.toBeNull();
  });

  test('should reject update items order in category with MenuchiError.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { id: itemId } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const promise = backlogController.reorderItemsInCategory(backlogId!, [randomUUID(), itemId]);

    await expect(promise).rejects.toThrowError(MenuchiError);
  });
});

describe('POST /backlog/{backlogId}/categories', () => {
  test('should create category successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const promise = backlogController.createCategory(backlogId!, { categoryNameId });

    await expect(promise).resolves.toMatchObject({ backlogId, categoryNameId });
  });

  test('should rejects create category with constraint error..', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    await backlogController.createCategory(backlogId!, { categoryNameId });
    const promise = backlogController.createCategory(backlogId!, { categoryNameId });

    await expect(promise).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });
});

describe('PATCH /backlog/{backlogId}/reorder-items/in-list', () => {
  test('should update items order in list successfully (204, null body).', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { id: itemId1 } = await backlogController.createItem(backlogId!, {
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
    const promise = backlogController.reorderItemsInList(backlogId!, [itemId3, itemId2, itemId1]);

    await expect(promise).resolves.toBeNull();
    // Effect check: getItems is ordered by positionInItemsList.
    const items = await backlogController.getItems(backlogId!);
    expect(items.map((i) => i.id)).toEqual([itemId3, itemId2, itemId1]);
  });

  test('should reject update items order in list with MenuchiError.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { id: itemId } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    await backlogController.createItem(backlogId!, { categoryNameId, ...itemObject });
    const promise = backlogController.reorderItemsInList(backlogId!, [randomUUID(), itemId]);

    await expect(promise).rejects.toThrowError(MenuchiError);
  });
});

describe('DELETE /backlog/{backlogId}/items', () => {
  test('should delete multiple items successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { id: itemId1 } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });
    const { id: itemId2 } = await backlogController.createItem(backlogId!, {
      categoryNameId,
      ...itemObject,
    });

    await backlogController.deleteItems(backlogId!, [itemId1, itemId2]);
    const promise1 = backlogService.getItem(itemId1);
    const promise2 = backlogService.getItem(itemId2);

    await expect(promise1).rejects.toThrowError(ItemNotFound);
    await expect(promise2).rejects.toThrowError(ItemNotFound);
  });
});

describe('PATCH /backlog/{backlogId}/reorder-categories', () => {
  test('should update categories order in backlog successfully (204, null body).', async () => {
    const { id: categoryNameId1 } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: categoryNameId2 } =
      await categoryNameController.createCategoryName(returnCategoryName());
    const { id: categoryNameId3 } =
      await categoryNameController.createCategoryName(returnCategoryName());
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { categoryId: categoryId1 } = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId1,
      ...itemObject,
    });
    const { categoryId: categoryId2 } = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId2,
      ...itemObject,
    });
    const { categoryId: categoryId3 } = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId3,
      ...itemObject,
    });
    const promise = backlogController.reorderCategoriesInBacklog(backlogId!, [
      categoryId3!,
      categoryId2!,
      categoryId1!,
    ]);

    await expect(promise).resolves.toBeNull();
  });

  test('should reject update categories order in backlog with MenuchiError.', async () => {
    const { id: categoryNameId1 } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const { id: categoryNameId2 } =
      await categoryNameController.createCategoryName(returnCategoryName());
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId1,
      ...itemObject,
    });
    await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId2,
      ...itemObject,
    });
    const promise = backlogController.reorderCategoriesInBacklog(backlogId!, [
      randomUUID(),
      categoryId!,
    ]);

    await expect(promise).rejects.toThrowError(MenuchiError);
  });
});

describe('DELETE /backlog/{backlogId}/categories', () => {
  test('should delete multiple categories successfully.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    const { categoryId } = await backlogController.createItem(backlogId!, {
      categoryNameId: categoryNameId,
      ...itemObject,
    });

    await backlogController.deleteCategory(backlogId!, categoryId!);
    const promise = backlogService.getCategory(categoryId!);

    await expect(promise).rejects.toThrowError(CategoryNotFound);
  });
});

describe('GET /backlog/{backlogId}/category-names', () => {
  test('should retrieves all category names used in the specific backlog.', async () => {
    const { id: categoryNameId } =
      await categoryNameController.createCategoryName(categoryNameObject);
    await categoryNameController.createCategoryName(returnCategoryName());
    const backlogId = (await restaurantController.createRestaurant(restaurantObject))?.branches?.[0]
      ?.backlog?.id;
    await backlogController.createCategory(backlogId!, { categoryNameId });
    const categoryNames = await backlogController.getAllCategoryNames(backlogId!);

    expect(categoryNames).toMatchObject([{ id: categoryNameId }]);
    expect(categoryNames.length).toBe(1);
  });
});
