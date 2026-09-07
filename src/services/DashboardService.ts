import { PrismaClient } from "@prisma/client";
import prismaClient from "../db/prisma";
import { ItemCompleteOut } from "../types/ItemTypes";
import { UUID } from "../types/TypeAliases";
import { Days } from "../types/Enums";
import S3Service, { PresignedUrlGenerator } from "./S3Service";

export class DashboardService {
  constructor(
    private prisma: PrismaClient = prismaClient,
    private s3: PresignedUrlGenerator = S3Service
  ) {}

  async getDayItems(userId: UUID): Promise<ItemCompleteOut[] | never> {
      const currentDay = Object.values(Days)[new Date().getDay()];

      const userRestaurants = await this.prisma.restaurant.findMany({
        where: {
          managerId: userId,
          deletedAt: null
        },
        include: {
          branches: {
            where: {
              deletedAt: null
            },
            include: {
              menus: {
                where: {
                  deletedAt: null,
                  isPublished: true
                },
                include: {
                  cylinders: {
                    where: {
                      deletedAt: null,
                      [currentDay]: true
                    },
                    include: {
                      menuCategories: {
                        where: {
                          deletedAt: null
                        },
                        include: {
                          items: {
                            where: {
                              isActive: true,
                              deletedAt: null
                            }
                          },
                          category: {
                            include: {
                              categoryName: true
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const menusItems: ItemCompleteOut[] = [];
      userRestaurants.forEach(restaurant => {
        restaurant.branches.forEach(branch => {
          branch.menus.forEach(menu => {
            menu.cylinders.forEach(cylinder => {
              cylinder.menuCategories.forEach(menuCategory => {
                menuCategory.items.forEach(async (item) => {
                  menusItems.push({
                    id: item.id,
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                    deletedAt: item.deletedAt,
                    categoryId: menuCategory.categoryId,
                    categoryNameId: menuCategory.category?.categoryNameId,
                    categoryName: menuCategory.category?.categoryName?.name,
                    name: item.name,
                    ingredients: item.ingredients,
                    price: item.price,
                    picUrl: item.picKey ? await this.s3.generateGetPresignedUrl(item.picKey) : null,
                    isActive: item.isActive,
                    orderCount: item.orderCount
                  });
                });
              });
            });
          });
        });
      });

      return menusItems.sort((a, b) => (b.orderCount ?? 0) - (a.orderCount ?? 0));
  }
}

export default new DashboardService();