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
import { isRecordNotFound } from '../utils/prismaErrors';
import { getS3Service, PresignedUrlGenerator } from './S3Service';

export class RestaurantService {
  private s3: PresignedUrlGenerator;

  constructor(
    private prisma: PrismaClient = prismaClient,
    s3?: PresignedUrlGenerator
  ) {
    this.s3 = s3 ?? getS3Service();
  }

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
            openingTimes: true,
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
              openingTimes: true,
            },
          },
        },
      })
      .catch((error: Error) => {
        if (isRecordNotFound(error)) throw new RestaurantNotFound();
        throw error;
      });

    return {
      ...restaurant,
      avatarUrl: (await this.s3.generateGetPresignedUrl(avatarKey)) ?? null,
      coverUrl: (await this.s3.generateGetPresignedUrl(coverKey)) ?? null,
      logoUrl: (await this.s3.generateGetPresignedUrl(logoKey)) ?? null,
    };
  }

  async updateRestaurant(restaurantId: UUID, restaurantDTO: UpdateRestaurantCompactIn) {
    return this.prisma.restaurant.update({
      where: {
        id: restaurantId,
      },
      data: restaurantDTO,
    });
  }
}

let shared: RestaurantService | undefined;

/** Lazy singleton accessor — no Prisma/S3 work happens on import. */
export function getRestaurantService(): RestaurantService {
  if (!shared) shared = new RestaurantService();
  return shared;
}
