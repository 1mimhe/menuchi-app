import { describe, expect, test } from 'vitest';
import { returnCategoryName } from '../factories';
import { CategoryNameController } from '../../src/controllers/CategoryNameController';
import { Prisma } from '@prisma/client';

const categoryNameObject = returnCategoryName();
const controller = new CategoryNameController();

describe('POST /category-names', async () => {
  test('should create category name successfully.', async () => {
    const promise = controller.createCategoryName(categoryNameObject);
    await expect(promise).resolves.toMatchObject({ name: categoryNameObject.name });
  });

  test('should reject create category name with constraint error.', async () => {
    await controller.createCategoryName(categoryNameObject);
    const promise = controller.createCategoryName(categoryNameObject);
    await expect(promise).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });
});

describe('GET /category-names', () => {
  test('should retrieved all category names successfully.', async () => {
    await controller.createCategoryName(categoryNameObject);
    const promise = controller.getAllCategoryNames();
    await expect(promise).resolves.toMatchObject([categoryNameObject]);
  });
});
