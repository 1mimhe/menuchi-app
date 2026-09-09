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
import MenuchiError from '../exceptions/MenuchiError';
import {
  CategoryCompactOut,
  CategoryCompleteOut,
  CategoryNameCompleteOut,
  CreateCategoryCompactIn,
} from '../types/CategoryTypes';
import { isForeignKeyViolation, isRecordNotFound } from '../utils/prismaErrors';
import { withUniqueRetry } from '../utils/positionRetry';
import { getS3Service, PresignedUrlGenerator } from './S3Service';

export class BacklogService {
  private s3: PresignedUrlGenerator;

  constructor(
    private prisma: PrismaClient = prismaClient,
    s3?: PresignedUrlGenerator
  ) {
    // Lazy default keeps `new BacklogService(mockPrisma)` working in tests
    // without creating an S3 client on import.
    this.s3 = s3 ?? getS3Service();
  }

  async createItem(
    backlogId: UUID,
    { categoryNameId, name, ingredients, price, picKey }: ItemCompactIn
  ): Promise<CreateItemCompleteOut | never> {
    // Retry wrapper: concurrent creates can read the same max position.
    return withUniqueRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const maxCategoryPosition = await tx.category.aggregate({
          _max: {
            positionInBacklog: true,
          },
          where: {
            backlogId,
          },
        });

        const positionInBacklog = (maxCategoryPosition._max.positionInBacklog ?? 0) + 1;

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
            if (isForeignKeyViolation(error, 'categories_backlog_id_fkey'))
              throw new BacklogNotFound();
            if (isForeignKeyViolation(error, 'categories_category_name_id_fkey'))
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

        const positionInItemsList = (maxItemPositions._max.positionInItemsList ?? 0) + 1;
        const positionInCategory = (maxItemPositions._max.positionInCategory ?? 0) + 1;

        if (!picKey) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { getEnv } = require('../config/env') as typeof import('../config/env');
            picKey = getEnv().S3_DEFAULT_KEY;
          } catch {
            picKey = undefined;
          }
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
      })
    );
  }

  async getItem(id: UUID): Promise<ItemCompleteOut | never> {
    return this.prisma.item
      .findUniqueOrThrow({
        where: {
          id,
          deletedAt: null,
        },
      })
      .catch((error: Error) => {
        if (isRecordNotFound(error)) throw new ItemNotFound();
        throw error;
      });
  }

  async getCategory(id: UUID): Promise<CategoryCompleteOut | never> {
    return this.prisma.category
      .findUniqueOrThrow({
        where: {
          id,
          deletedAt: null,
        },
      })
      .catch((error: Error) => {
        if (isRecordNotFound(error)) throw new CategoryNotFound();
        throw error;
      });
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
                  positionInCategory: 'asc',
                },
              },
            },
            omit: {
              categoryNameId: true,
            },
            orderBy: {
              positionInBacklog: 'asc',
            },
          },
        },
      })
      .catch((error: Error) => {
        if (isRecordNotFound(error)) throw new BacklogNotFound();
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
              picUrl: await this.s3.generateGetPresignedUrl(item.picKey),
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
        picUrl: await this.s3.generateGetPresignedUrl(item.picKey),
        picKey: undefined,
      }))
    );
  }

  async updateItem(backlogId: UUID, itemId: UUID, itemDTO: UpdateItemIn) {
    itemDTO = Object.fromEntries(Object.entries(itemDTO).filter(([, value]) => value !== null));
    return this.prisma.item.update({
      where: {
        id: itemId,
        category: {
          backlog: {
            id: backlogId,
          },
        },
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
            id: backlogId,
          },
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
    // Retry wrapper: concurrent creates can read the same max position.
    return withUniqueRetry(() =>
      this.prisma.$transaction(async (tx) => {
        const maxCategoryPosition = await tx.category.aggregate({
          _max: {
            positionInBacklog: true,
          },
          where: {
            backlogId,
          },
        });

        const positionInBacklog = (maxCategoryPosition._max.positionInBacklog ?? 0) + 1;

        return tx.category.create({
          data: {
            backlogId,
            categoryNameId,
            positionInBacklog,
          },
        });
      })
    );
  }

  async reorderItemsInCategory(backlogId: UUID, itemsId: UUID[]) {
    await this.isValidItemsId(backlogId, itemsId);
    // Two-step swap: the @@unique (category_id, position) guard is checked
    // per-row, so a single CASE swap (1->3 while 3 still exists) raises
    // P2003/23505 mid-update. Bumping targets out of range first keeps every
    // intermediate state unique. Same pattern in all reorder* methods.
    const OFFSET = 1000000;
    const ids = Prisma.join(itemsId.map((id) => Prisma.sql`${id}::uuid`));
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "items" SET "position_in_category" = "position_in_category" + ${OFFSET}
        WHERE "id" IN (${ids})
      `;
      return tx.$executeRaw`
        UPDATE "items"
        SET "position_in_category" = CASE "id"
          ${Prisma.join(
            itemsId.map((itemId, index) => Prisma.sql`WHEN ${itemId}::uuid THEN ${index + 1}`),
            ' '
          )}
        ELSE "position_in_category"
        END
        WHERE "id" IN (${ids})
      `;
    });
  }

  async reorderItemsInList(backlogId: UUID, itemsId: UUID[]) {
    await this.isValidItemsId(backlogId, itemsId, false);
    const OFFSET = 1000000;
    const ids = Prisma.join(itemsId.map((id) => Prisma.sql`${id}::uuid`));
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "items" SET "position_in_items_list" = "position_in_items_list" + ${OFFSET}
        WHERE "id" IN (${ids})
      `;
      return tx.$executeRaw`
        UPDATE "items"
        SET "position_in_items_list" = CASE "id"
          ${Prisma.join(
            itemsId.map((itemId, index) => Prisma.sql`WHEN ${itemId}::uuid THEN ${index + 1}`),
            ' '
          )}
        ELSE "position_in_items_list"
        END
        WHERE "id" IN (${ids})
      `;
    });
  }

  private async isValidItemsId(
    backlogId: UUID,
    itemsId: UUID[],
    areSameCategory = true
  ): Promise<void | never> {
    const items = await this.prisma.item.findMany({
      where: {
        id: {
          in: itemsId,
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
      const categoryIds = new Set(items.map((item) => item.categoryId));
      if (categoryIds.size > 1)
        throw new MenuchiError('All item IDs must belong to the same category.', 400);
    }
  }

  async reorderCategoriesInBacklog(backlogId: UUID, categoriesId: UUID[]) {
    await this.isValidCategoriesId(backlogId, categoriesId);
    const OFFSET = 1000000;
    const ids = Prisma.join(categoriesId.map((id) => Prisma.sql`${id}::uuid`));
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "categories" SET "position_in_backlog" = "position_in_backlog" + ${OFFSET}
        WHERE "id" IN (${ids})
      `;
      return tx.$executeRaw`
        UPDATE "categories"
        SET "position_in_backlog" = CASE "id"
          ${Prisma.join(
            categoriesId.map(
              (categoryId, index) => Prisma.sql`WHEN ${categoryId}::uuid THEN ${index + 1}`
            ),
            ' '
          )}
        ELSE "position_in_backlog"
        END
        WHERE "id" IN (${ids})
      `;
    });
  }

  async deleteCategory(backlogId: UUID, categoryId: UUID) {
    return this.prisma.$transaction(async (tx) => {
      await tx.category.update({
        where: {
          id: categoryId,
          backlog: {
            id: backlogId,
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });

      await tx.item.updateMany({
        where: {
          categoryId,
          category: {
            backlog: {
              id: backlogId,
            },
          },
        },
        data: {
          deletedAt: new Date(),
        },
      });
    });
  }

  private async isValidCategoriesId(backlogId: UUID, categoriesId: UUID[]): Promise<void | never> {
    const categories = await this.prisma.category.findMany({
      where: {
        deletedAt: null,
        backlogId,
      },
    });

    const isValidQuery =
      categories.length === categoriesId.length &&
      categories.every((category) => categoriesId.some((categoryId) => categoryId === category.id));
    if (!isValidQuery) throw new MenuchiError('All category IDs must be in the request.', 400);
  }

  async getAllCategoryNames(backlogId: UUID): Promise<CategoryNameCompleteOut[]> {
    const categoryNames = await this.prisma.categoryName.findMany({
      where: {
        categories: {
          some: {
            backlogId,
          },
        },
      },
      include: {
        categories: {
          where: {
            backlogId,
          },
        },
      },
    });

    return categoryNames.map((cn) => ({
      ...cn,
      categoryId: cn.categories[0].id,
      categories: undefined,
    }));
  }
}

let shared: BacklogService | undefined;

/** Lazy singleton accessor — no Prisma/S3 work happens on import. */
export function getBacklogService(): BacklogService {
  if (!shared) shared = new BacklogService();
  return shared;
}
