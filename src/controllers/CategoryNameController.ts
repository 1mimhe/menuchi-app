import { Body, Get, Post, Response, Route, Security, SuccessResponse, Tags } from 'tsoa';
import { CategoryNameCompactIn, CategoryNameCompleteOut } from '../types/CategoryTypes';
import { resolveContainer } from '../container';
import { CategoryNameValidationError } from '../exceptions/ValidationError';
import { ConstraintsDatabaseError } from '../exceptions/DatabaseError';
import BaseController from './BaseController';
import { ForbiddenError, UnauthorizedError } from '../exceptions/AuthError';
import { RolesEnum } from '../types/Enums';

@Route('/category-names')
@Tags('Category Name')
export class CategoryNameController extends BaseController {
  /**
   * Creates a new category name.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<ConstraintsDatabaseError>(
    409,
    'ConstraintsDatabaseError -> A category name with the provided name already exists.'
  )
  @Response<CategoryNameValidationError>(422, '4222 CategoryNameValidationError')
  @SuccessResponse(201, 'Category name created successfully.')
  @Security('', [RolesEnum.Admin])
  @Post()
  public async createCategoryName(
    @Body() body: CategoryNameCompactIn
  ): Promise<CategoryNameCompleteOut> {
    return resolveContainer().categoryName.createCategoryName(body);
  }

  /**
   * Retrieves all category names.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @SuccessResponse(200, 'All category names retrieved successfully.')
  @Security('', [RolesEnum.Admin, RolesEnum.RestaurantOwner])
  @Get()
  public async getAllCategoryNames(): Promise<CategoryNameCompleteOut[]> {
    return resolveContainer().categoryName.getAllCategoryNames();
  }
}
