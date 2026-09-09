import {
  Body,
  Get,
  Patch,
  Path,
  Post,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';
import { resolveContainer } from '../container';
import {
  RestaurantCompactIn,
  CreateRestaurantCompleteOut,
  UpdateRestaurantCompactIn,
  RestaurantCompleteOut,
} from '../types/RestaurantTypes';
import { RestaurantValidationError } from '../exceptions/ValidationError';
import { ConstraintsDatabaseError } from '../exceptions/DatabaseError';
import { UUID } from '../types/TypeAliases';
import { RestaurantNotFound } from '../exceptions/NotFoundError';
import BaseController from './BaseController';
import { PermissionScope, RolesEnum, SessionUpdateScope } from '../types/Enums';
import express from 'express';
import { ForbiddenError, UnauthorizedError } from '../exceptions/AuthError';
import { RestaurantUpdateSession } from '../types/AuthTypes';

@Route('/restaurants')
@Tags('Restaurant')
export class RestaurantController extends BaseController {
  /**
   * Creates a new restaurant along with its first branch and backlog.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<ConstraintsDatabaseError>(
    409,
    'ConstraintsDatabaseError -> A restaurant or branch with the provided displayName already exists.'
  )
  @Response<RestaurantValidationError>(422, '4221 RestaurantValidationError')
  @SuccessResponse(201, 'Restaurant, a branch and its backlog created successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post()
  public async createRestaurant(
    @Body() body: RestaurantCompactIn,
    @Request() req?: express.Request
  ): Promise<CreateRestaurantCompleteOut> {
    const restaurant = await resolveContainer(req).restaurant.createRestaurant(
      body,
      req?.session.user?.id
    );

    const updateSession = {
      userSession: req?.session.user,
      restaurantId: restaurant.id,
      branch: {
        id: restaurant.branches?.[0].id,
        backlogId: restaurant.branches?.[0].backlog?.id,
      },
    } as RestaurantUpdateSession;
    this.updateSession(SessionUpdateScope.Restaurant, updateSession);

    return restaurant;
  }

  /**
   * Retrieves full details of a specific restaurant by its ID, include its branches.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<RestaurantNotFound>(404, '4041 RestaurantNotFound')
  @SuccessResponse(200, 'Restaurant is retrieved successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Get('/{restaurantId}')
  public async getRestaurant(
    @Path() restaurantId: UUID,
    @Request() req?: express.Request
  ): Promise<RestaurantCompleteOut> {
    this.checkPermission(req?.session.user, PermissionScope.Restaurant, restaurantId);
    return resolveContainer(req).restaurant.getRestaurant(restaurantId);
  }

  /**
   * Updates a restaurant.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<RestaurantValidationError>(422, '4221 RestaurantValidationError')
  @SuccessResponse(204, "Restaurant updated successfully. It doesn't retrieve anything.")
  @Security('', [RolesEnum.RestaurantOwner])
  @Patch('/{restaurantId}')
  async updateRestaurant(
    @Path() restaurantId: UUID,
    @Body() body: UpdateRestaurantCompactIn,
    @Request() req?: express.Request
  ): Promise<null> {
    this.checkPermission(req?.session.user, PermissionScope.Restaurant, restaurantId);
    await resolveContainer(req).restaurant.updateRestaurant(restaurantId, body);
    return null;
  }
}
