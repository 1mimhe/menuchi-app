import { PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import { CategoryNameCompactIn, CategoryNameCompleteOut } from '../types/CategoryTypes';

export class CategoryNameService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async createCategoryName(categoryNameDTO: CategoryNameCompactIn): Promise<CategoryNameCompleteOut | never> {
    return this.prisma.categoryName.create({
      data: categoryNameDTO
    });
  }

  async getAllCategoryNames(): Promise<CategoryNameCompleteOut[] | never> {
    return this.prisma.categoryName.findMany();
  }
}

export default new CategoryNameService();
