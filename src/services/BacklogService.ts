import { Prisma, PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import {
  UpdateItemIn,
  ItemCompactIn,
  ItemCompleteOut,
  CreateItemCompleteOut,
} from '../types/ItemTypes';
import { UUID } from '../types/TypeAliases';
import {
  BacklogNotFound,
  CategoryNameNotFound,
  CategoryNotFound,
  ItemNotFound,
} from '../exceptions/NotFoundError';
import { BacklogCompleteOut } from '../types/RestaurantTypes';
import S3Service from './S3Service';
import MenuchiError from '../exceptions/MenuchiError';
import { CategoryCompactOut, CategoryCompleteOut, CategoryNameCompleteOut, CreateCategoryCompactIn } from '../types/CategoryTypes';

export class BacklogService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async createItem(
    backlogId: UUID,
    { categoryNameId, name, ingredients, price, picKey }: ItemCompactIn
  ): Promise<CreateItemCompleteOut | never> {
    return this.prisma.$transaction(async (tx) => {
      const maxCategoryPosition = await tx.category.aggregate({
        _max: {
          positionInBacklog: true,
        },
        where: {
          backlogId,
        },
      });

      const positionInBacklog =
        (maxCategoryPosition._max.positionInBacklog ?? 0) + 1;

      const category = await tx.category
        .upsert({
          where: {
            backlogId_categoryNameId: {
              backlogId: backlogId,
              categoryNameId: categoryNameId,
            },
          },
          update: {},
          create: {
            backlogId: backlogId,
            categoryNameId: categoryNameId,
            positionInBacklog,
          },
          include: {
            categoryName: true,
          },
        })
        .catch((error: Error) => {
          if (error.message.includes('categories_backlog_id_fkey'))
            throw new BacklogNotFound();
          if (
            error.message.includes('categories_category_name_id_fkey')
          )
            throw new CategoryNameNotFound();
          throw error;
        });
      
      const maxItemPositions = await tx.item.aggregate({
        _max: {
          positionInItemsList: true,
          positionInCategory: true,
        },
        where: {
          categoryId: category.id,
        },
      });

      const positionInItemsList =
        (maxItemPositions._max.positionInItemsList ?? 0) + 1;
      const positionInCategory =
        (maxItemPositions._max.positionInCategory ?? 0) + 1;

      if (!picKey) {
        picKey = process.env.S3_DEFAULT_KEY;
      }

      const item = await tx.item.create({
        data: {
          categoryId: category.id,
          name,
          ingredients,
          price,
          picKey,
          positionInItemsList,
          positionInCategory,
        },
      });

      return {
        ...item,
        categoryName: category.categoryName?.name,
      };
    });
  }

  async getItem(id: UUID): Promise<ItemCompleteOut | never> {
    return this.prisma.item.findUniqueOrThrow({
      where: {
        id,
        deletedAt: null
      }
    }).catch((error: Error) => {
      if (error.message.includes('not found')) throw new ItemNotFound();
      throw error;
    });
  }

  async getCategory(id: UUID): Promise<CategoryCompleteOut | never> {
    return this.prisma.category.findUniqueOrThrow({
      where: {
        id,
        deletedAt: null
      }
    }).catch((error: Error) => {
      if (error.message.includes('not found')) throw new CategoryNotFound();
      throw error;
    });;
  }

  async getBacklog(backlogId: UUID): Promise<BacklogCompleteOut | never> {
    const backlog = await this.prisma.backlog
      .findUniqueOrThrow({
        where: {
          id: backlogId,
        },
        include: {
          categories: {
            where: {
              deletedAt: null,
            },
            include: {
              categoryName: true,
              items: {
                where: {
                  deletedAt: null,
                },
                orderBy: {
                  positionInCategory: 'asc'
                }
              },
            },
            omit: {
              categoryNameId: true,
            },
            orderBy: {
              positionInBacklog: 'asc'
            }
          },
        },
      })
      .catch((error: Error) => {
        if (error.message.includes('not found')) throw new BacklogNotFound();
        throw error;
      });

    return {
      ...backlog,
      categories: await Promise.all(
        backlog.categories.map(async (category) => ({
          ...category,
          categoryNameId: category.categoryName?.id,
          categoryName: category.categoryName?.name ?? null,
          items: await Promise.all(
            category.items.map(async (item) => ({
              ...item,
              categoryName: category.categoryName?.name ?? null,
              picUrl: await S3Service.generateGetPresignedUrl(item.picKey),
              picKey: undefined,
            }))
          ),
        }))
      ),
    };
  }

  async getItems(backlogId: UUID): Promise<ItemCompleteOut[]> {
    const items = await this.prisma.item.findMany({
      where: {
        deletedAt: null,
        category: {
          deletedAt: null,
          backlog: {
            id: backlogId,
          },
        },
      },
      include: {
        category: {
          include: {
            categoryName: true,
          },
        },
      },
      orderBy: {
        positionInItemsList: 'asc',
      },
    });

    return await Promise.all(
      items.map(async (item) => ({
        ...item,
        categoryNameId: item.category?.categoryName?.id,
        categoryName: item.category?.categoryName?.name,
        category: undefined,
        picUrl: await S3Service.generateGetPresignedUrl(item.picKey),
        picKey: undefined,
      }))
    );
  }

  async updateItem(backlogId: UUID, itemId: UUID, itemDTO: UpdateItemIn) {
    itemDTO = Object.fromEntries(
      Object.entries(itemDTO).filter(([key, value]) => value !== null)
    );
    return this.prisma.item.update({
      where: {
        id: itemId,
        category: {
          backlog: {
            id: backlogId
          }
        }
      },
      data: itemDTO,
    });
  }

  async deleteItems(backlogId: UUID, itemsId: UUID[]) {
    return this.prisma.item.updateMany({
      where: {
        id: {
          in: itemsId,
        },
        category: {
          backlog: {
            id: backlogId
          }
        },
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  async createCategory(
    backlogId: UUID,
    { categoryNameId }: CreateCategoryCompactIn
  ): Promise<CategoryCompactOut | never> {
    return this.prisma.$transaction(async (tx) => {
      const maxCategoryPosition = await tx.category.aggregate({
        _max: {
          positionInBacklog: true,
        },
        where: {
          backlogId,
        },
      });

      const positionInBacklog =
        (maxCategoryPosition._max.positionInBacklog ?? 0) + 1;

      return tx.category.create({
        data: {
          backlogId,
          categoryNameId,
          positionInBacklog
        }
      });
    });
  }

  async reorderItemsInCategory(backlogId: UUID, itemsId: UUID[]) {
    await this.isValidItemsId(backlogId, itemsId);
    return this.prisma.$executeRaw`
      UPDATE "items"
      SET "position_in_category" = CASE "id"
        ${Prisma.join(itemsId.map((itemId, index) => Prisma.sql`WHEN ${itemId}::uuid THEN ${index + 1}`), ' ')}
      ELSE "position_in_category"
      END
      WHERE "id" IN (${Prisma.join(itemsId.map(id => Prisma.sql`${id}::uuid`))})
    `;
  }

  async reorderItemsInList(backlogId: UUID, itemsId: UUID[]) {
    await this.isValidItemsId(backlogId, itemsId, false);
    return this.prisma.$executeRaw`
      UPDATE "items"
      SET "position_in_items_list" = CASE "id"
        ${Prisma.join(itemsId.map((itemId, index) => Prisma.sql`WHEN ${itemId}::uuid THEN ${index + 1}`), ' ')}
      ELSE "position_in_items_list"
      END
      WHERE "id" IN (${Prisma.join(itemsId.map(id => Prisma.sql`${id}::uuid`))})
    `;
  }

  private async isValidItemsId(backlogId: UUID, itemsId: UUID[], areSameCategory = true): Promise<void | never> {
    const items = await this.prisma.item.findMany({
        where: {
          id: {
            in: itemsId
          },
          deletedAt: null,
          category: {
            deletedAt: null,
            backlog: {
              id: backlogId,
            },
          },
        },
        select: {
          id: true,
          categoryId: true,
        },
    });

    if (items.length !== itemsId.length) {
      throw new MenuchiError('Some item IDs are invalid or do not belong to the backlog.', 400);
    }

    if (areSameCategory) {
      const categoryIds = new Set(items.map(item => item.categoryId));
      if (categoryIds.size > 1)
        throw new MenuchiError('All item IDs must belong to the same category.', 400);
    }
  }

  async reorderCategoriesInBacklog(backlogId: UUID, categoriesId: UUID[]) {
    await this.isValidCategoriesId(backlogId, categoriesId);
    return this.prisma.$executeRaw`
      UPDATE "categories"
      SET "position_in_backlog" = CASE "id"
        ${Prisma.join(categoriesId.map((categoryId, index) => Prisma.sql`WHEN ${categoryId}::uuid THEN ${index + 1}`), ' ')}
      ELSE "position_in_backlog"
      END
      WHERE "id" IN (${Prisma.join(categoriesId.map(id => Prisma.sql`${id}::uuid`))})
    `;
  }

  async deleteCategory(backlogId: UUID, categoryId: UUID) {
    return this.prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: {
          id: categoryId,
          backlog: {
            id: backlogId
          }
        },
        data: {
          deletedAt: new Date()
        }
      });

      await tx.item.updateMany({
        where: {
          categoryId,
          category: {
            backlog: {
              id: backlogId
            }
          }
        },
        data: {
          deletedAt: new Date()
        }
      });
    });
  }

  private async isValidCategoriesId(backlogId: UUID, categoriesId: UUID[]): Promise<void | never> {
    const categories = await this.prisma.category.findMany({
      where: {
        deletedAt: null,
        backlogId
      }
    });

    const isValidQuery = (categories.length === categoriesId.length) &&
            categories.every(category => categoriesId.some(categoryId => categoryId === category.id ));
    if (!isValidQuery) throw new MenuchiError('All category IDs must be in the request.', 400);
  }

  async getAllCategoryNames(backlogId: UUID): Promise<CategoryNameCompleteOut[]> {
    const categoryNames = await this.prisma.categoryName.findMany({
      where: {
        categories: {
          some: {
            backlogId
          }
        }
      },
      include: {
        categories: {
          where: {
            backlogId
          }
        }
      }
    });

    return categoryNames.map(cn => ({
      ...cn,
      categoryId: cn.categories[0].id,
      categories: undefined
    }));
  }
}

export default new BacklogService();