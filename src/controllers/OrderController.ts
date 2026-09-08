import { Post, Route, Security, SuccessResponse, Tags, Response, Body, Request, Path, Get, Patch, Delete, Query } from "tsoa";
import BaseController from "./BaseController";
import { ForbiddenError, UnauthorizedError } from "../exceptions/AuthError";
import { OrderStatus, PermissionScope, RolesEnum } from "../types/Enums";
import express from 'express';
import OrderService from "../services/OrderService";
import { CreateOrderCompactIn, CreateOrderCompleteIn, OrderCompleteOut } from "../types/OrderTypes";
import { Int, UUID } from "../types/TypeAliases";
import { ItemNotFound } from "../exceptions/NotFoundError";

@Route()
@Tags('Order')
export class OrderController extends BaseController {
  /**
   * Creates a new order for a specific menu.
   * 
   * Accessible to restaurant customers.
   */
  @Response<ItemNotFound>(404, '4043 ItemNotFound')
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(201, 'Order created successfully.')
  @Security('', [RolesEnum.RestaurantCustomer])
  @Post('/menus/{menuId}/orders')
  async createOrder(
    @Path() menuId: UUID,
    @Body() body: CreateOrderCompactIn,
    @Request() req?: express.Request
  ): Promise<OrderCompleteOut> {
    // NOTE (customer identity): for OTP customers the session user id IS the
    // verified email (see AuthController.checkOtp). Owners use createOrderByOwner
    // with an explicit customerEmail instead.
    const customerEmail = req?.session.user?.id as string;
    const order = await OrderService.createOrder(customerEmail, menuId, body);
    const user = req!.session.user!;
    user.recentlyOrderIds ??= [];
    user.recentlyOrderIds.push(order.id);
    return order;
  }

  /**
   * Creates a new order for a specific menu.
   * 
   * Accessible to restaurant owners.
   */
  @Response<ItemNotFound>(404, '4043 ItemNotFound')
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(201, 'Order created successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/menus/{menuId}/orders/by-owner')
  async createOrderByOwner(
    @Path() menuId: UUID,
    @Body() body: CreateOrderCompleteIn,
    @Request() req?: express.Request
  ): Promise<OrderCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    return OrderService.createOrder(body.customerEmail, menuId, body);
  }

  /**
   * Retrieves all orders for a specific menu.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'All the menu orders retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/menus/{menuId}/orders')
  async getOrders(
    @Path() menuId: UUID,
    @Query() skip?: Int,
    @Query() limit?: Int,
    /**
     * Filters orders based on completion status.
     * 
     * Set to `false` to retrieve only ongoing (not completed) orders.
     * 
     * Defaults to `true`, which returns all orders.
     */
    @Query() isCompleted?: boolean,
    @Request() req?: express.Request
  ): Promise<OrderCompleteOut[]> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    return OrderService.getOrders(menuId, skip, limit, isCompleted);
  }

  /**
   * Retrieves all orders for a specific branch (all its menus's orders).
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'All the branch orders retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/branches/{branchId}/orders')
  async getAllOrders(
    @Path() branchId: UUID,
    @Query() skip?: Int,
    @Query() limit?: Int,
    /**
     * Filters orders based on completion status.
     * 
     * Set to `false` to retrieve only ongoing (not completed) orders.
     * 
     * Defaults to `true`, which returns all orders.
     */
    @Query() isCompleted?: boolean,
    @Request() req?: express.Request
  ): Promise<OrderCompleteOut[]> {
    this.checkPermission(req?.session.user, PermissionScope.Branch, branchId);
    return OrderService.getAllOrders(branchId, skip, limit, isCompleted);
  }

  /**
   * Retrieves the current customer's recently created orders.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'All the menu orders retrieved successfully.')
  @Security('', [RolesEnum.RestaurantCustomer])
  @Get('/customer/orders')
  async getRecentlyOrders(@Request() req?: express.Request): Promise<OrderCompleteOut[]> {
    return OrderService.getRecentlyOrders(req!.session.user!.recentlyOrderIds!);
  }

  /**
   * Updates the status of a specific order within a menu.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'All the menu orders retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/menus/{menuId}/orders/{orderId}')
  async updateOrderStatus(
    @Path() menuId: UUID,
    @Path() orderId: UUID,
    @Body() body: { status: OrderStatus },
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await OrderService.updateOrderStatus(orderId, body.status);
    return null;
  }

  /**
   * Deletes multiple orders from a menu.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(204, 'Orders deleted successfully. It doesn\'t retrieve anything.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Delete('/menus/{menuId}/orders')
  async deleteOrders(
    @Path() menuId: UUID,
    @Body() orderItemsId: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await OrderService.deleteOrders(menuId, orderItemsId);
    return null;
  }
}