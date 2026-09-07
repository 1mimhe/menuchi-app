import { PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import {
  RestaurantCompactIn,
  CreateRestaurantCompleteOut,
  UpdateRestaurantCompactIn,
  RestaurantCompleteOut,
} from '../types/RestaurantTypes';
import { UUID } from '../types/TypeAliases';
import { RestaurantNotFound } from '../exceptions/NotFoundError';
import S3Service from './S3Service';

export class RestaurantService {
  constructor(private prisma: PrismaClient = prismaClient) {}

 async createRestaurant(
    restaurantDTO: RestaurantCompactIn,
    managerId?: UUID
  ): Promise<CreateRestaurantCompleteOut | never> {
    return this.prisma.restaurant.create({
      data: {
        managerId,
        ...restaurantDTO,
        branches: {
          create: {
            displayName: restaurantDTO.displayName,
            backlog: {
              create: {},
            },
          },
        },
      },
      include: {
        branches: {
          include: {
            backlog: true,
            address: true,
            openingTimes: true
          },
        },
      },
    });
  }

  async getRestaurant(restaurantId: UUID): Promise<RestaurantCompleteOut | never> {
    const { avatarKey, coverKey, logoKey, ...restaurant } = await this.prisma.restaurant
      .findUniqueOrThrow({
        where: {
          id: restaurantId,
        },
        include: {
          branches: {
            include: {
              backlog: true,
              address: true,
              openingTimes: true
            },
          },
        },
      })
      .catch((error: Error) => {
        if (error.message.includes('not found')) throw new RestaurantNotFound();
        throw error;
      });

    return {
      ...restaurant,
      avatarUrl: await S3Service.generateGetPresignedUrl(avatarKey) ?? null,
      coverUrl: await S3Service.generateGetPresignedUrl(coverKey) ?? null,
      logoUrl: await S3Service.generateGetPresignedUrl(logoKey) ?? null
    };
  }

  
  async updateRestaurant(restaurantId: UUID, restaurantDTO: UpdateRestaurantCompactIn) {
    return this.prisma.restaurant.update({
      where: {
        id: restaurantId
      },
      data: restaurantDTO
    });
  }
}

export default new RestaurantService();
