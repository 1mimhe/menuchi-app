import { Get, Request, Response, Route, Security, SuccessResponse, Tags } from 'tsoa';
import BaseController from './BaseController';
import { RolesEnum } from '../types/Enums';
import express from 'express';
import { UserSession } from '../types/AuthTypes';
import { ForbiddenError, UnauthorizedError } from '../exceptions/AuthError';
import { ItemCompleteOut } from '../types/ItemTypes';
import { resolveContainer } from '../container';

@Route('/dashboard')
@Tags('Dashboard')
export class UserController extends BaseController {
  /**
   * Retrieves the profile of the currently authorized user.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'Authorized user profile retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner, RolesEnum.RestaurantCustomer])
  @Get('/profile')
  public async getProfile(@Request() req: express.Request): Promise<UserSession | undefined> {
    return req.session.user;
  }

  /**
   * Returns today's menus items sorted by descending order count.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, "Today's menu items is retrieved successfully.")
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/day-items')
  public async getDayItems(@Request() req: express.Request): Promise<ItemCompleteOut[]> {
    return resolveContainer(req).dashboard.getDayItems(req.session.user?.id as string);
  }
}
