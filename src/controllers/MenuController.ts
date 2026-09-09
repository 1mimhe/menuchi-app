import {
  Body,
  Delete,
  Get,
  Patch,
  Path,
  Post,
  Query,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { DefaultString, UUID } from '../types/TypeAliases';
import { resolveContainer } from '../container';
import {
  CylinderCompactIn,
  CreateCylinderCompleteOut,
  MenuCategoryCompactIn,
  CreateMenuCategoryCompleteOut,
  MenuCompactIn,
  MenuCompletePlusOut,
  CreateMenuCompactIn,
  MenuPreviewCompleteOut,
  MenuViewCompleteOut,
  CreateMenuCompleteOut,
  MenuCompleteWithCountsOut,
} from '../types/MenuTypes';
import {
  CylinderValidationError,
  MenuCategoryValidationError,
  MenuValidationError,
} from '../exceptions/ValidationError';
import { ConstraintsDatabaseError } from '../exceptions/DatabaseError';
import MenuchiError from '../exceptions/MenuchiError';
import {
  BranchNotFound,
  CategoryNotFound,
  CylinderNotFound,
  MenuNotFound,
} from '../exceptions/NotFoundError';
import { BacklogCompleteOut } from '../types/RestaurantTypes';
import { PermissionScope, RolesEnum, SessionUpdateScope } from '../types/Enums';
import BaseController from './BaseController';
import express from 'express';
import { ForbiddenError, UnauthorizedError } from '../exceptions/AuthError';
import { MenuUpdateSession } from '../types/AuthTypes';

@Route('/menus')
@Tags('Menu')
export class MenuController extends BaseController {
  /**
   * Retrieves a backlog by ID.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<BranchNotFound>(404, '4049 BranchNotFound')
  @SuccessResponse(200, 'Backlog is retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/backlog/{backlogId}')
  public async getBacklog(
    @Path() backlogId: UUID,
    @Query() search?: DefaultString,
    @Request() req?: express.Request
  ): Promise<BacklogCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Backlog, backlogId);
    return resolveContainer(req).menu.getBacklog(backlogId, search);
  }

  /**
   * Creates a new menu.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<BranchNotFound>(404, '4049 BranchNotFound')
  @SuccessResponse(201, 'Menu created successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post()
  async createMenu(
    @Body() body: CreateMenuCompactIn,
    @Request() req?: express.Request
  ): Promise<CreateMenuCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Branch, body.branchId);
    const { restaurantId, ...menu } = await resolveContainer(req).menu.createMenu(body);

    const updateSession = {
      userSession: req?.session.user,
      restaurantId: restaurantId,
      branchId: menu.branchId,
      menuId: menu.id,
    } as MenuUpdateSession;
    this.updateSession(SessionUpdateScope.Menu, updateSession);

    return menu;
  }

  /**
   * Retrieves all branch menus.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'Menus are retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/branch/{branchId}')
  public async getAllMenus(
    @Path() branchId: UUID,
    @Request() req?: express.Request
  ): Promise<MenuCompleteWithCountsOut[]> {
    this.checkPermission(req?.session.user, PermissionScope.Branch, branchId);
    return resolveContainer(req).menu.getAllMenus(branchId);
  }

  /**
   * Retrieves a complete menu by ID.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuNotFound>(404, '4048 MenuNotFound')
  @SuccessResponse(200, 'Menu is retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/{menuId}')
  public async getMenu(
    @Path() menuId: UUID,
    @Request() req?: express.Request
  ): Promise<MenuCompletePlusOut> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    return resolveContainer(req).menu.getMenu(menuId);
  }

  /**
   * Updates a menu.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuNotFound>(404, '4048 MenuNotFound')
  @Response<MenuValidationError>(422, '4228 MenuValidationError')
  @SuccessResponse(204, 'Menu updated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{menuId}')
  async updateMenu(
    @Path() menuId: UUID,
    @Body() body: MenuCompactIn,
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.updateMenu(menuId, body);
    return null;
  }

  /**
   * Creates a new cylinder in a menu.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<CylinderNotFound>(404, '4046 CylinderNotFound')
  @Response<CategoryNotFound>(404, '40412 CategoryNotFound')
  @Response<MenuNotFound>(404, '4048 MenuNotFound')
  @Response<ConstraintsDatabaseError>(
    409,
    'ConstraintsDatabaseError -> A cylinder with the same provided days are already exists.'
  )
  @Response<CylinderValidationError>(422, '4226 CylinderValidationError')
  @SuccessResponse(201, 'Cylinder created successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/{menuId}/cylinders')
  async createCylinder(
    @Path() menuId: UUID,
    @Body() body: CylinderCompactIn,
    @Request() req?: express.Request
  ): Promise<CreateCylinderCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);

    const isValid = Object.values(body).some((value) => value);
    if (!isValid) throw new CylinderValidationError();

    return resolveContainer(req).menu.createCylinder(menuId, body);
  }

  /**
   * Reorders cylinders.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuchiError>(400, 'All menu cylinder IDs must be in the request.')
  @SuccessResponse(204, 'Cylinder orders in the menu updated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{menuId}/cylinders')
  async reorderCylinders(
    @Path() menuId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.reorderCylinders(menuId, body);
    return null;
  }

  /**
   * Creates a new menu category.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<CylinderNotFound>(404, '4046 CylinderNotFound')
  @Response<MenuNotFound>(404, '4048 MenuNotFound')
  @Response<MenuchiError>(400, 'All item IDs must belong to the specified category.')
  @Response<ConstraintsDatabaseError>(
    409,
    'ConstraintsDatabaseError -> A menu category with the same name already exists within the specified cylinder.'
  )
  @Response<MenuCategoryValidationError>(422, '4227 MenuCategoryValidationError')
  @SuccessResponse(201, 'Menu Category created successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/{menuId}/categories')
  async createMenuCategory(
    @Path() menuId: UUID,
    @Body() body: MenuCategoryCompactIn,
    @Request() req?: express.Request
  ): Promise<CreateMenuCategoryCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);

    if (body.items.length < 1) throw new MenuCategoryValidationError();

    return resolveContainer(req).menu.createMenuCategory(menuId, body);
  }

  /**
   * Reorders menu items.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuchiError>(400, 'All item IDs must belong to the same menu category.')
  @Response<MenuchiError>(400, 'Some item IDs are invalid or do not belong to the menu.')
  @SuccessResponse(204, 'Menu item orders in the menu category updated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{menuId}/items')
  async reorderMenuItems(
    @Path() menuId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.reorderMenuItems(menuId, body);
    return null;
  }

  /**
   * Deletes menu categories.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(204, 'Menu Categories deleted successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Delete('/{menuId}/categories')
  async deleteMenuCategory(
    @Path() menuId: UUID,
    @Body() body: UUID[],
    @Request() req: express.Request
  ): Promise<null> {
    this.checkPermission(req.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.deleteMenuCategory(menuId, body);
    return null;
  }

  /**
   * Reorders menu categories.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuchiError>(400, 'All menu category IDs must be in the request.')
  @SuccessResponse(204, 'Menu category orders in the cylinder updated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{menuId}/categories')
  async reorderMenuCategories(
    @Path() menuId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.reorderMenuCategories(menuId, body);
    return null;
  }

  /**
   * Hide/Unhide a menu item.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(204, 'Menu Item hide/unhide successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{menuId}/items/{menuItemId}/hide/{isHide}')
  async hideMenuItem(
    @Path() menuId: UUID,
    @Path() menuItemId: UUID,
    @Path() isHide: boolean,
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.hideMenuItem(menuId, menuItemId, !isHide);
    return null;
  }

  /**
   * Deletes menu items.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(204, 'Menu Items deleted successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Delete('/{menuId}/items')
  async deleteMenuItems(
    @Path() menuId: UUID,
    @Body() body: UUID[],
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.deleteMenuItems(menuId, body);
    return null;
  }

  /**
   * Deletes a menu.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(204, 'Menu deleted successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Delete('/{menuId}')
  async deleteMenu(@Path() menuId: UUID, @Request() req?: express.Request): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Menu, menuId);
    await resolveContainer(req).menu.deleteMenu(menuId);
    return null;
  }

  /**
   * Retrieves a menu preview by its id.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuNotFound>(404, '4048 MenuNotFound')
  @SuccessResponse(200, 'Menu preview is retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/{menuId}/preview')
  public async getMenuPreview(
    @Path() menuId: UUID,
    @Request() req: express.Request
  ): Promise<MenuPreviewCompleteOut> {
    this.checkPermission(req.session.user, PermissionScope.Menu, menuId);
    return resolveContainer(req).menu.getMenuPreview(menuId);
  }

  /**
   * Retrieves a menu preview by its id for customer.
   *
   * Publicly accessible. No authentication required.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<MenuNotFound>(404, '4048 MenuNotFound')
  @SuccessResponse(200, 'Menu preview is retrieved successfully.')
  @Get('/{menuId}/view')
  public async getCustomerMenuPreview(@Path() menuId: UUID): Promise<MenuViewCompleteOut> {
    return resolveContainer().menu.getMenuView(menuId);
  }
}
