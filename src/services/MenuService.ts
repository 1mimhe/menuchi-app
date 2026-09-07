import { Prisma, PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import { UUID } from '../types/TypeAliases';
import { CylinderCompactIn, CreateCylinderCompleteOut, MenuCategoryCompactIn, CreateMenuCategoryCompleteOut, MenuCompactIn, MenuCompleteOut, MenuCompletePlusOut, CreateMenuCompactIn, OwnerPreviewCompactOut, MenuPreviewCompleteOut, MenuViewCompleteOut as MenuViewCompleteOut, MenuCategoryCompleteOut, MenuCompleteWithCountsOut, MenuCompeteWithResIdOut } from '../types/MenuTypes';
import MenuchiError from '../exceptions/MenuchiError';
import { BranchNotFound, CategoryNotFound, CylinderNotFound, MenuNotFound } from '../exceptions/NotFoundError';
import { isForeignKeyViolation, isRecordNotFound } from '../utils/prismaErrors';
import S3Service from './S3Service';
import { BacklogCompleteOut } from '../types/RestaurantTypes';
import { Days } from '../types/Enums';

export class MenuService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async createMenu(body: CreateMenuCompactIn): Promise<MenuCompeteWithResIdOut | never> {
    const { branch, ...newMenu } = await this.prisma.menu.create({
      data: body,
      include: {
        branch: true
      }
    }).catch((error: Error) => {
      if (isForeignKeyViolation(error, 'menus_branch_id_fkey'))
        throw new BranchNotFound();
      throw error;
    });

    const restaurantId = branch?.restaurantId;

    return {
      ...newMenu,
      restaurantId: restaurantId
    };
  }

  async updateMenu(menuId: UUID, menuDTO: MenuCompactIn) {
    return this.prisma.menu.update({
      where: {
        id: menuId
      },
      data: menuDTO
    })
    .catch((error: Error) => {
      if (isRecordNotFound(error))
        throw new MenuNotFound();
      throw error;
    });
  }

  async createCylinder(menuId: UUID, cylinderDTO: CylinderCompactIn): Promise<CreateCylinderCompleteOut | never> {
    return this.prisma.$transaction(async (tx) => {
      const maxPositionInMenu = await tx.cylinder.aggregate({
        _max: {
          positionInMenu: true
        },
        where: {
          menuId,
          deletedAt: null
        }
      }).catch((error: Error) => {
        if (isForeignKeyViolation(error, 'cylinders_menu_id_fkey'))
          throw new MenuNotFound();
        throw error;
      });

      const positionInMenu = (maxPositionInMenu._max.positionInMenu ?? 0) + 1;

      return tx.cylinder.create({
        data: {
          menuId,
          ...cylinderDTO,
          positionInMenu
        }
      }).catch((error: Error) => {
        if (isForeignKeyViolation(error, 'cylinders_menu_id_fkey'))
          throw new MenuNotFound();
        throw error;
      });
    });
  }

  async reorderCylinders(menuId: UUID, cylindersId: UUID[]) {
    await this.isValidCylindersId(menuId, cylindersId);
    return this.prisma.$executeRaw`
      UPDATE "cylinders"
      SET "position_in_menu" = CASE "id"
        ${Prisma.join(cylindersId.map((cylinderId, index) => Prisma.sql`WHEN ${cylinderId}::uuid THEN ${index + 1}`), ' ')}
      ELSE "position_in_menu"
      END
      WHERE "id" IN (${Prisma.join(cylindersId.map(id => Prisma.sql`${id}::uuid`))})
    `;
  }

  async createMenuCategory(
    menuId: UUID,
    {
      categoryId,
      cylinderId,
      items 
    }: MenuCategoryCompactIn
  ): Promise<CreateMenuCategoryCompleteOut | never> {
    return this.prisma.$transaction(async (tx) => {
      const validItems = await tx.item.findMany({
        where: {
          id: {
            in: items
          },
          categoryId: categoryId,
          deletedAt: null,
        },
        orderBy: {
          positionInCategory: 'asc',
        },
        select: {
          id: true
        },
      });

      if (validItems.length !== items.length) {
        throw new MenuchiError('All item IDs must belong to the specified category.', 400);
      }

      const maxPositionInCylinder = await tx.menuCategory.aggregate({
        _max: {
          positionInCylinder: true
        },
        where: {
          cylinder: {
            menuId,
            deletedAt: null
          }
        }
      });

      const positionInCylinder = (maxPositionInCylinder._max.positionInCylinder ?? 0) + 1;

      await tx.category.findUniqueOrThrow({
        where: {
          id: categoryId,
          backlog: {
            branch: {
              menus: {
                some: {
                  id: menuId
                }
              }
            }
          },
          deletedAt: null
        }
      }).catch((error: Error) => {
          if (isRecordNotFound(error))
            throw new MenuNotFound();
          throw error;
      });

      const newMenuCategory = await tx.menuCategory.create({
        data: {
          categoryId, cylinderId, positionInCylinder,
          items: {
            connect: validItems.map(item => ({ id: item.id }))
          }
        }
      }).catch((error: Error) => {
        if (isForeignKeyViolation(error, 'menu_categories_cylinder_id_fkey'))
          throw new CylinderNotFound();
        if (isForeignKeyViolation(error, 'menu_categories_category_id_fkey'))
          throw new CategoryNotFound();
        throw error;
      });

      await tx.$executeRaw`
        UPDATE "items"
        SET "position_in_menu_categories" = CASE "id"
          ${Prisma.join(validItems.map((item, index) => Prisma.sql`WHEN ${item.id}::uuid THEN ${index + 1}`), ' ')}
        ELSE "position_in_menu_categories"
        END
        WHERE "id" IN (${Prisma.join(validItems.map(item => Prisma.sql`${item.id}::uuid`))})
      `;

      return newMenuCategory;
    });
  }

  async getMenuCategory(menuCategoryId: UUID) {
    return this.prisma.menuCategory.findUniqueOrThrow({
      where: {
        id: menuCategoryId,
        deletedAt: null
      },
      include: {
        items: true
      }
    });
  }

  async reorderMenuCategories(menuId: UUID, menuCategoriesId: UUID[]) {
    await this.isValidMenuCategoriesId(menuId, menuCategoriesId);
    return this.prisma.$executeRaw`
      UPDATE "menu_categories"
      SET "position_in_cylinder" = CASE "id"
        ${Prisma.join(menuCategoriesId.map((menuCategory, index) => Prisma.sql`WHEN ${menuCategory}::uuid THEN ${index + 1}`), ' ')}
      ELSE "position_in_cylinder"
      END
      WHERE "id" IN (${Prisma.join(menuCategoriesId.map(id => Prisma.sql`${id}::uuid`))})
    `;
  }

  async deleteMenuCategory(menuId: UUID, menuCategoriesId: UUID[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.menuCategory.deleteMany({
        where: {
          id: {
            in: menuCategoriesId
          },
          cylinder: {
            menuId
          }
        }
      });

      await tx.item.updateMany({
        where: {
          menuCategoryId: {
            in: menuCategoriesId
          },
          menuCategory: {
            cylinder: {
              menuId
            }
          }
        },
        data: {
          positionInMenuCategory: null,
          isActive: true
        }
      });
    });
  }

  async reorderMenuItems(menuId: UUID, menuItemsId: UUID[]) {
    await this.isValidMenuItemsId(menuId, menuItemsId);
    return this.prisma.$executeRaw`
      UPDATE "items"
      SET "position_in_menu_categories" = CASE "id"
        ${Prisma.join(menuItemsId.map((menuItem, index) => Prisma.sql`WHEN ${menuItem}::uuid THEN ${index + 1}`), ' ')}
      ELSE "position_in_menu_categories"
      END
      WHERE "id" IN (${Prisma.join(menuItemsId.map(id => Prisma.sql`${id}::uuid`))})
    `;
  }

  async deleteMenuItems(menuId: UUID, menuItemsId: UUID[]) {
    return this.prisma.item.updateMany({
      where: {
        id: {
          in: menuItemsId
        },
        menuCategory: {
          cylinder: {
            menuId
          }
        }
      },
      data: {
        menuCategoryId: null,
        positionInMenuCategory: null,
        isActive: true
      }
    });
  }

  async hideMenuItem(menuId: UUID, menuItemId: UUID, isActive: boolean) {
    return this.prisma.item.update({
      where: {
        id: menuItemId,
        menuCategory: {
          cylinder: {
            menuId
          }
        },
        deletedAt: null
      },
      data: {
        isActive
      }
    });
  }

  private async isValidMenuItemsId(menuId: UUID, itemsId: UUID[], areSameMenuCategory = true): Promise<void | never> {
    const items = await this.prisma.item.findMany({
      where: {
        id: {
          in: itemsId
        },
        deletedAt: null,
        menuCategory: {
          cylinder: {
            menuId
          }
        }
      },
      select: {
         id: true,
         menuCategoryId: true
      }
    });
  
    if (items.length !== itemsId.length)
      throw new MenuchiError('Some item IDs are invalid or do not belong to the menu.', 400);

    if (areSameMenuCategory) {
      const menuCategoryIds = new Set(items.map(item => item.menuCategoryId));
      if (menuCategoryIds.size > 1)
        throw new MenuchiError('All item IDs must belong to the same menu category.', 400);
    }
  }

  private async isValidMenuCategoriesId(menuId: UUID, menuCategoriesId: UUID[]): Promise<void | never> {
    const menuCategories = await this.prisma.menuCategory.findMany({
      where: {
        id: {
          in: menuCategoriesId
        },
        cylinder: {
          menuId
        }
      },
      select: {
        id: true
      }
    });
    
    if (menuCategories.length !== menuCategoriesId.length)
      throw new MenuchiError('All menu category IDs must be in the request.', 400);
  }

  private async isValidCylindersId(menuId: UUID, cylindersId: UUID[]): Promise<void | never> {
    const cylinders = await this.prisma.cylinder.findMany({
      where: {
        id: {
          in: cylindersId
        },
        menuId
      },
      select: {
        id: true
      }
    });
    
    if (cylinders.length !== cylindersId.length) throw new MenuchiError('All cylinder IDs must be in the request.', 400);
  }

  async deleteMenu(menuId: UUID) {
    return this.prisma.$transaction(async (tx) => {
      await tx.menu.update({
        where: {
          id: menuId
        },
        data: {
          deletedAt: new Date()
        }
      });

      await tx.cylinder.updateMany({
        where: {
          menuId
        },
        data: {
          deletedAt: new Date()
        }
      });

      await tx.menuCategory.updateMany({
        where: {
          cylinder: {
            menuId
          }
        },
        data: {
          deletedAt: new Date()
        }
      });
    });
  }

  async getBacklog(backlogId: UUID, search = ''): Promise<BacklogCompleteOut | never> {
      const backlog = await this.prisma.backlog
        .findUniqueOrThrow({
          where: {
            id: backlogId,
          },
          include: {
            categories: {
              where: {
                deletedAt: null,
                categoryName: {
                  name: {
                    contains: search,
                    mode: 'insensitive'
                  }
                }
              },
              include: {
                categoryName: true,
                items: {
                  where: {
                    deletedAt: null,
                    menuCategoryId: null
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
                positionInBacklog: 'asc'
              }
            },
          },
        })
        .catch((error: Error) => {
          if (isRecordNotFound(error))
            throw new BranchNotFound();
          throw error;
        });
  
      return {
        ...backlog,
        categories: await Promise.all(
          backlog.categories.map(async (category) => ({
            ...category,
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

  async getAllMenus(branchId: UUID): Promise<MenuCompleteWithCountsOut[]> {
    const menus = await this.prisma.menu.findMany({
      where: {
        branchId,
        deletedAt: null
      },
      include: {
        _count: {
          select: {
            cylinders: true
          }
        },
        cylinders: {
          include: {
            menuCategories: {
              include: {
                _count: {
                  select: {
                    items: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const categoriesSet = new Set<UUID>();
    return Promise.all(menus.map(async (menu) => ({
      ...menu,
      cylindersCount: menu._count.cylinders,
      itemsCount: menu.cylinders.reduce((acc, cylinder) => {
        return cylinder.menuCategories.reduce((acc, mc) => {
          categoriesSet.add(mc.categoryId!);
          return mc._count.items + acc
        }, 0) + acc
      }, 0),
      categoriesCount: categoriesSet.size,
      favicon: await S3Service.generateGetPresignedUrl(menu.favicon),
      cylinders: undefined,
      _count: undefined
    })));
  }

  async getMenu(menuId: UUID): Promise<MenuCompletePlusOut | never> {
    const menu = await this.prisma.menu.findUniqueOrThrow({
      where: {
        id: menuId,
        deletedAt: null
      },
      include: {
        cylinders: {
          include: {
            menuCategories: {
              include: {
                category: {
                  select: {
                    categoryName: true
                  }
                },
                items: {
                  orderBy: {
                    positionInMenuCategory: 'asc'
                  }
                }
              },
              orderBy: {
                positionInCylinder: 'asc'
              }
            }
          },
          orderBy: {
            positionInMenu: 'asc'
          }
        }
      }
    })
    .catch((error: Error) => {
      if (isRecordNotFound(error))
        throw new MenuNotFound();
      throw error;
    });

    return {
      ...menu,
      favicon: await S3Service.generateGetPresignedUrl(menu.favicon),
      cylinders: await Promise.all(menu.cylinders.map(async (cylinder) => ({
        ...cylinder,
        days: [
          cylinder.sat,
          cylinder.sun,
          cylinder.mon,
          cylinder.tue,
          cylinder.wed,
          cylinder.thu,
          cylinder.fri
        ],
        sat: undefined,
        sun: undefined,
        mon: undefined,
        tue: undefined,
        wed: undefined,
        thu: undefined,
        fri: undefined,
        menuCategories: await Promise.all(cylinder.menuCategories.map(async (menuCategory) => ({
          ...menuCategory,
          categoryName: menuCategory.category?.categoryName?.name ?? null,
          category: undefined,
          items: await Promise.all(
            menuCategory.items.map(async (item) => ({
              ...item,
              picUrl: await S3Service.generateGetPresignedUrl(item.picKey),
              picKey: undefined,
            }))
          ),
        })))
      })))
    };
  }

  async getCompactMenu(menuId: UUID): Promise<MenuCompleteOut | never> {
    return this.prisma.menu.findUniqueOrThrow({
      where: {
        id: menuId,
        deletedAt: null
      }
    })
    .catch((error: Error) => {
      if (isRecordNotFound(error))
        throw new MenuNotFound();
      throw error;
    });
  }

  async getMenuPreview(menuId: UUID): Promise<MenuPreviewCompleteOut | never> {
    const { cylinders, ...menu } = await this.prisma.menu.findUniqueOrThrow({
      where: {
        id: menuId,
        deletedAt: null
      },
      include: {
        cylinders: {
          include: {
            menuCategories: {
              include: {
                items: {
                  orderBy: {
                    positionInMenuCategory: 'asc'
                  },
                  where: {
                    isActive: true
                  }
                },
                category: {
                  include: {
                    categoryName: true
                  },
                }
              },
              orderBy: {
                positionInCylinder: 'asc'
              }
            }
          },
          orderBy: {
            positionInMenu: 'asc'
          }
        }
      }
    }).catch((error: Error) => {
      if (isRecordNotFound(error))
        throw new MenuNotFound();
      throw error;
    });

    const previewByDay = Object.values(Days).reduce((acc, day) => {
      acc[day] = [];
      const categoryMap = new Map<string, MenuCategoryCompleteOut>();

       cylinders
        .filter(cylinder => cylinder[day])
        .forEach(cylinder =>
          cylinder.menuCategories.forEach(mc => {
            const categoryId = mc.categoryId!;

            if (!categoryMap.has(categoryId)) {
              categoryMap.set(categoryId, {
                ...mc,
                ...mc.category,
                categoryId,
                categoryName: mc.category?.categoryName?.name ?? null,
                items: [...(mc.items ?? [])],
              });
            } else {
              const existing = categoryMap.get(categoryId);
              existing?.items?.push(...(mc.items ?? []));
            }
          })
        );

      acc[day] = Array.from(categoryMap.values()).map(cat => ({
        ...cat,
        items: cat.items?.sort(
          (a, b) =>
            (a.positionInMenuCategory ?? 0) - (b.positionInMenuCategory ?? 0)
        ),
      }));
      return acc;
    }, {} as OwnerPreviewCompactOut);

    return {
      ...menu,
      favicon: await S3Service.generateGetPresignedUrl(menu.favicon),
      ...previewByDay
    };
  }

  async getMenuView(menuId: UUID): Promise<MenuViewCompleteOut | never> {
    const currentDay = Object.values(Days)[new Date().getDay()];

    const { cylinders, ...menu } = await this.prisma.menu.findUniqueOrThrow({
      where: {
        id: menuId,
        deletedAt: null
      },
      include: {
        branch: {
          include: {
            address: true,
            openingTimes: true
          }
        },
        cylinders: {
          where: {
            [currentDay]: true
          },
          include: {
            menuCategories: {
              include: {
                items: {
                  orderBy: {
                    positionInMenuCategory: 'asc'
                  },
                  where: {
                    isActive: true
                  }
                },
                category: {
                  include: {
                    categoryName: true
                  }
                }
              },
              orderBy: {
                positionInCylinder: 'asc'
              }
            }
          },
          orderBy: {
            positionInMenu: 'asc'
          }
        }
      }
    }).catch((error: Error) => {
      if (isRecordNotFound(error))
        throw new MenuNotFound();
      throw error;
    });

    const categoryMap = new Map<string, MenuCategoryCompleteOut>();
    cylinders
      .forEach(cylinder =>
        cylinder.menuCategories.forEach(mc => {
            const categoryId = mc.categoryId!;

            if (!categoryMap.has(categoryId)) {
              categoryMap.set(categoryId, {
                ...mc,
                ...mc.category,
                categoryId,
                categoryName: mc.category?.categoryName?.name ?? null,
                items: [...(mc.items ?? [])],
              });
            } else {
              const existing = categoryMap.get(categoryId);
              existing?.items?.push(...(mc.items ?? []));
            }
      }));

    const dayMenu = Array.from(categoryMap.values()).map(cat => ({
        ...cat,
        items: cat.items?.sort(
          (a, b) =>
            (a.positionInMenuCategory ?? 0) - (b.positionInMenuCategory ?? 0)
        ),
    }));

    return {
      ...menu,
      favicon: await S3Service.generateGetPresignedUrl(menu.favicon),
      currentDay,
      menuCategories: dayMenu
    };
  }
}

export default new MenuService();