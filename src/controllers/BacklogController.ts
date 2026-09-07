import { Body, Delete, Get, Patch, Path, Post, Request, Response, Route, Security, SuccessResponse, Tags } from "tsoa";
import { UpdateItemIn, ItemCompactIn, ItemCompleteOut, CreateItemCompleteOut } from "../types/ItemTypes";
import BacklogService from "../services/BacklogService";
import { UUID } from "../types/TypeAliases";
import { BacklogCompleteOut } from "../types/RestaurantTypes";
import { ItemValidationError } from "../exceptions/ValidationError";
import { BacklogNotFound, CategoryNameNotFound } from "../exceptions/NotFoundError";
import BaseController from "./BaseController";
import express from 'express';
import { PermissionScope, RolesEnum, SyncOperations } from "../types/Enums";
import { ForbiddenError, UnauthorizedError } from "../exceptions/AuthError";
import MenuchiError from "../exceptions/MenuchiError";
import { CategoryCompactOut, CategoryNameCompleteOut, CreateCategoryCompactIn } from "../types/CategoryTypes";
import { ConstraintsDatabaseError } from "../exceptions/DatabaseError";

@Route('/backlog')
@Tags('Backlog')
export class BacklogController extends BaseController {
  /**
   * Creates a new backlog item and a category (if needed), using an existing category name.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<CategoryNameNotFound>(404, '4042 CategoryNameNotFound')
  @Response<BacklogNotFound>(404, '4044 BacklogNotFound')
  @Response<ItemValidationError>(422, '4223 ItemValidationError')
  @SuccessResponse(201, 'Item created successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/{backlogId}/items')
  public async createItem(
    @Path() backlogId: UUID,
    @Body() body: ItemCompactIn,
    @Request() req?: express.Request
  ): Promise<CreateItemCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);

    const item = await BacklogService.createItem(backlogId, body);
    await this.publish(undefined, item.picKey!, SyncOperations.Created);

    return item;
  }

  /**
   * Retrieves a specific backlog.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<BacklogNotFound>(404, '4044 BacklogNotFound')
  @SuccessResponse(200, 'Backlog is retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/{backlogId}')
  public async getBacklog(@Path() backlogId: UUID, @Request() req?: express.Request): Promise<BacklogCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    return BacklogService.getBacklog(backlogId);
  }

  /**
   * Retrieves all items in a backlog.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response(200, 'BacklogNotFound without raise any error.')
  @SuccessResponse(200, 'All backlog items retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/{backlogId}/items')
  public async getItems(@Path() backlogId: UUID, @Request() req?: express.Request): Promise<ItemCompleteOut[]> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    return BacklogService.getItems(backlogId);
  }

  /**
   * Updates an item in a backlog.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<ItemValidationError>(422, '4223 ItemValidationError')
  @SuccessResponse(204, 'Item updated successfully. It doesn\'t retrieve anything.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{backlogId}/items/{itemId}')
  public async updateItem(
    @Path() backlogId: UUID,
    @Path() itemId: UUID,
    @Body() body: UpdateItemIn,
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    await BacklogService.updateItem(backlogId, itemId, body);
    return null;
  }

  /**
   * Reorders items within a category.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuchiError>(400, 'All item IDs must belong to the same category.')
  @Response<MenuchiError>(400, 'Some item IDs are invalid or do not belong to the backlog.')
  @SuccessResponse(204, 'Item orders in the category updated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{backlogId}/reorder-items/in-category')
  public async reorderItemsInCategory(
    @Path() backlogId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    await BacklogService.reorderItemsInCategory(backlogId, body);
    return null;
  }

  /**
   * Reorders items within a list.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuchiError>(400, 'Some item IDs are invalid or do not belong to the backlog.')
  @SuccessResponse(204, 'Item orders in the list updated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{backlogId}/reorder-items/in-list')
  public async reorderItemsInList(
    @Path() backlogId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    await BacklogService.reorderItemsInList(backlogId, body);
    return null;
  }

  /**
   * Deletes multiple items from a backlog.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(204, 'Items deleted successfully. It doesn\'t retrieve anything.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Delete('/{backlogId}/items')
  public async deleteItems(
    @Path() backlogId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    await BacklogService.deleteItems(backlogId, body);
    return null;
  }

  /**
   * Creates a new category. Alternatively, creating an item will automatically create its category (if needed).
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<ConstraintsDatabaseError>(409, 'ConstraintsDatabaseError -> This category name is already used in this backlog.')
  @Security('', [RolesEnum.RestaurantOwner])
  @SuccessResponse(201, 'Category created successfully.')
  @Post('/{backlogId}/categories')
  public async createCategory(
    @Path() backlogId: UUID,
    @Body() body: CreateCategoryCompactIn,
    @Request() req?: express.Request
  ): Promise<CategoryCompactOut> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    return BacklogService.createCategory(backlogId, body);
  }

  /**
   * Reorders categories within a backlog.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuchiError>(400, 'All category IDs must be in the request.')
  @Security('', [RolesEnum.RestaurantOwner])
  @SuccessResponse(204, 'Category orders in the backlog updated successfully.')
  @Patch('/{backlogId}/reorder-categories')
  public async reorderCategoriesInBacklog(
    @Path() backlogId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    await BacklogService.reorderCategoriesInBacklog(backlogId, body);
    return null;
  }

  /**
   * Deletes a category and all its items.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(204, 'Category and its items deleted successfully.  It doesn\'t retrieve anything.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Delete('/{backlogId}/categories/{categoryId}')
  public async deleteCategory(
    @Path() backlogId: UUID,
    @Path() categoryId: UUID,
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    await BacklogService.deleteCategory(backlogId, categoryId);
    return null;
  }

  /**
   * Retrieves all category names used in the specific backlog.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'All category names retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/{backlogId}/category-names')
  public async getAllCategoryNames(
    @Path() backlogId: UUID,
    @Request() req?: express.Request
  ): Promise<CategoryNameCompleteOut[]> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    return BacklogService.getAllCategoryNames(backlogId);
  }
}