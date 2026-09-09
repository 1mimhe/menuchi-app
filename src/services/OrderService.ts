import { PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import { Email, UUID } from '../types/TypeAliases';
import { CreateOrderCompactIn, OrderCompleteOut } from '../types/OrderTypes';
import { getS3Service, PresignedUrlGenerator } from './S3Service';
import { OrderStatus } from '../types/Enums';
import { ItemNotFound } from '../exceptions/NotFoundError';

export class OrderService {
  private s3: PresignedUrlGenerator;

  constructor(
    private prisma: PrismaClient = prismaClient,
    s3?: PresignedUrlGenerator
  ) {
    this.s3 = s3 ?? getS3Service();
  }

  async createOrder(
    customerEmail: Email,
    menuId: UUID,
    { items }: CreateOrderCompactIn
  ): Promise<OrderCompleteOut | never> {
    return this.prisma.$transaction(async (tx) => {
      const dbItems = await tx.item.findMany({
        where: {
          id: {
            in: items.map((item) => item.itemId),
          },
          menuCategory: {
            cylinder: {
              menuId,
            },
          },
        },
        select: {
          id: true,
          price: true,
        },
      });

      // Reject partial matches: every requested item must exist under this menu,
      // otherwise totalPrice silently covers only a subset of the order.
      if (dbItems.length !== items.length) throw new ItemNotFound();

      let totalPrice = 0;
      const orderItems = dbItems.map((item) => {
        const amount = items.find((i) => item.id === i.itemId)?.amount ?? 1;
        totalPrice += amount * item.price!;
        return {
          itemId: item.id,
          amount,
          price: item.price,
        };
      });

      const order = await tx.order.create({
        data: {
          menuId,
          customerEmail,
          orderItems: {
            create: orderItems,
          },
          totalPrice,
        },
        include: {
          orderItems: {
            include: {
              item: true,
            },
          },
        },
      });

      return {
        ...order,
        orderItems: await Promise.all(
          order.orderItems.map(async (orderItem) => ({
            name: orderItem.item?.name,
            pikUrl: (await this.s3.generateGetPresignedUrl(orderItem.item?.picKey ?? null)) ?? null,
            ...orderItem,
            item: undefined,
          }))
        ),
        status: order.status as OrderStatus,
      };
    });
  }

  // NOTE (N+1 presigning): each order item triggers one S3 presign call.
  // Acceptable for typical order sizes; if this fans out, move to a CDN with
  // long-lived URLs or a single batch-presign endpoint (see Phase-3 logging).
  async getOrders(
    menuId: UUID,
    skip = 0,
    take = 10,
    isCompleted = true
  ): Promise<OrderCompleteOut[]> {
    const statusWhereClause = isCompleted
      ? {}
      : { in: [OrderStatus.Pending, OrderStatus.Preparing, OrderStatus.Ready] };
    const orders = await this.prisma.order.findMany({
      where: {
        menuId,
        status: statusWhereClause,
        deletedAt: null,
      },
      include: {
        orderItems: {
          include: {
            item: true,
          },
        },
      },
      skip,
      take,
    });

    return await Promise.all(
      orders.map(async (order) => ({
        ...order,
        orderItems: await Promise.all(
          order.orderItems.map(async (orderItem) => ({
            name: orderItem.item?.name,
            pikUrl: (await this.s3.generateGetPresignedUrl(orderItem.item?.picKey ?? null)) ?? null,
            ...orderItem,
            item: undefined,
          }))
        ),
        status: order.status as OrderStatus,
      }))
    );
  }

  async getAllOrders(
    branchId: UUID,
    skip = 0,
    take = 10,
    isCompleted = true
  ): Promise<OrderCompleteOut[]> {
    const statusWhereClause = isCompleted
      ? {}
      : { in: [OrderStatus.Pending, OrderStatus.Preparing, OrderStatus.Ready] };
    const orders = await this.prisma.order.findMany({
      where: {
        menu: {
          branchId,
        },
        status: statusWhereClause,
        deletedAt: null,
      },
      include: {
        orderItems: {
          include: {
            item: true,
          },
        },
      },
      skip,
      take,
    });

    return await Promise.all(
      orders.map(async (order) => ({
        ...order,
        orderItems: await Promise.all(
          order.orderItems.map(async (orderItem) => ({
            name: orderItem.item?.name,
            pikUrl: (await this.s3.generateGetPresignedUrl(orderItem.item?.picKey ?? null)) ?? null,
            ingredients: orderItem.item?.ingredients,
            ...orderItem,
            item: undefined,
          }))
        ),
        status: order.status as OrderStatus,
      }))
    );
  }

  async getRecentlyOrders(recentlyOrderIds: UUID[]): Promise<OrderCompleteOut[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        id: {
          in: recentlyOrderIds,
        },
      },
      include: {
        orderItems: {
          include: {
            item: true,
          },
        },
      },
    });

    return await Promise.all(
      orders.map(async (order) => ({
        ...order,
        orderItems: await Promise.all(
          order.orderItems.map(async (orderItem) => ({
            name: orderItem.item?.name,
            pikUrl: (await this.s3.generateGetPresignedUrl(orderItem.item?.picKey ?? null)) ?? null,
            ...orderItem,
            item: undefined,
          }))
        ),
        status: order.status as OrderStatus,
      }))
    );
  }

  async updateOrderStatus(orderId: UUID, status: OrderStatus) {
    return this.prisma.$transaction(async (tx) => {
      if (status === OrderStatus.Ready) {
        const orderItems = await tx.orderItem.findMany({
          where: {
            orderId,
          },
          select: {
            itemId: true,
            amount: true,
          },
        });

        await Promise.all(
          orderItems.map(({ itemId, amount }) => {
            if (!itemId) return Promise.resolve();
            return tx.item.update({
              where: {
                id: itemId,
              },
              data: {
                orderCount: {
                  increment: amount ?? 1,
                },
              },
            });
          })
        );
      }

      return tx.order.update({
        where: {
          id: orderId,
        },
        data: {
          status,
        },
      });
    });
  }

  async deleteOrders(menuId: UUID, ordersId: UUID[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.order.updateMany({
        where: {
          id: {
            in: ordersId,
          },
          menuId,
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });

      await tx.orderItem.updateMany({
        where: {
          orderId: {
            in: ordersId,
          },
          order: {
            menuId,
          },
          deletedAt: null,
        },
        data: {
          deletedAt: new Date(),
        },
      });
    });
  }
}

let shared: OrderService | undefined;

/** Lazy singleton accessor — no Prisma/S3 work happens on import. */
export function getOrderService(): OrderService {
  if (!shared) shared = new OrderService();
  return shared;
}
