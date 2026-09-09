import { PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import { CategoryNameCompactIn, CategoryNameCompleteOut } from '../types/CategoryTypes';

export class CategoryNameService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async createCategoryName(
    categoryNameDTO: CategoryNameCompactIn
  ): Promise<CategoryNameCompleteOut | never> {
    return this.prisma.categoryName.create({
      data: categoryNameDTO,
    });
  }

  async getAllCategoryNames(): Promise<CategoryNameCompleteOut[] | never> {
    return this.prisma.categoryName.findMany();
  }
}

let shared: CategoryNameService | undefined;

/** Lazy singleton accessor — no Prisma work happens on import. */
export function getCategoryNameService(): CategoryNameService {
  if (!shared) shared = new CategoryNameService();
  return shared;
}
