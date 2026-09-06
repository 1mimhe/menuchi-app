import { Body, Post, Request, Response, Route, Security, SuccessResponse, Tags } from "tsoa";
import S3Service from "../services/S3Service";
import { GetItemPicUrlIn, GetItemPicUrlOut, GetMenuFaviconUrlIn, GetMenuFaviconUrlOut, GetRestaurantAvatarPicUrlOut, GetRestaurantCoverPicUrlOut, GetRestaurantLogoPicUrlOut, GetRestaurantPicUrlIn } from "../types/S3Types";
import { S3ValidationError } from "../exceptions/ValidationError";
import BaseController from "./BaseController";
import { PermissionScope, RolesEnum } from "../types/Enums";
import express from 'express';
import { ForbiddenError, UnauthorizedError } from "../exceptions/AuthError";
import prismaClient from "../db/prisma";

@Route('/s3')
@Tags('S3')
export class S3Controller extends BaseController {
  /**
   * Generates a pre-signed URL for uploading an item picture to S3.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<S3ValidationError>(422, '4224 S3ValidationError')
  @SuccessResponse(201, 'Item pic presigned url generated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/get-item-pic-url')
  public async generatePutItemPicPresignedUrl(
    @Body() body: GetItemPicUrlIn,
    @Request() req: express.Request
  ): Promise<GetItemPicUrlOut> {
    const { restaurantId, branchId, fileName } = body;
    const bucketName = process.env.S3_BUCKETNAME;

    this.checkPermission(req.session.user, PermissionScope.Branch, branchId);

    // Never trust client restaurantId for key prefix — resolve server-side.
    const branch = await prismaClient.branch.findUnique({
      where: { id: branchId },
      select: { restaurantId: true },
    });
    if (!branch?.restaurantId || branch.restaurantId !== restaurantId) {
      throw new ForbiddenError();
    }

    const itemPicKey = `${bucketName}/Restaurants/${restaurantId}/Items/${branchId}/${fileName}`;
    const itemPicUrl = await S3Service.generatePutPresignedUrl(itemPicKey);
    return {
      itemPicUrl,
      itemPicKey
    };
  }

  /**
   * Generates a pre-signed URL for uploading an restaurant cover picture to S3.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<S3ValidationError>(422, '4224 S3ValidationError')
  @SuccessResponse(201, 'Restaurant cover pic presigned url generated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/get-res-cover-pic-url')
  public async generatePutRestaurantCoverPicPresignedUrl(
    @Body() body: GetRestaurantPicUrlIn,
    @Request() req: express.Request
  ): Promise<GetRestaurantCoverPicUrlOut> {
    const { restaurantId, fileName } = body;
    const bucketName = process.env.S3_BUCKETNAME;

    this.checkPermission(req.session.user, PermissionScope.Restaurant, restaurantId);

    const restaurantCoverPicKey = `${bucketName}/Restaurants/${restaurantId}/Cover-${fileName}`;
    const restaurantCoverPicUrl = await S3Service.generatePutPresignedUrl(restaurantCoverPicKey);
    return {
      restaurantCoverPicUrl,
      restaurantCoverPicKey
    };
  }

  /**
   * Generates a pre-signed URL for uploading an restaurant avatar picture to S3.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<S3ValidationError>(422, '4224 S3ValidationError')
  @SuccessResponse(201, 'Restaurant avatar pic presigned url generated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/get-res-avatar-pic-url')
  public async generatePutRestaurantAvatarPicPresignedUrl(
    @Body() body: GetRestaurantPicUrlIn,
    @Request() req: express.Request
  ): Promise<GetRestaurantAvatarPicUrlOut> {
    const { restaurantId, fileName } = body;
    const bucketName = process.env.S3_BUCKETNAME;

    this.checkPermission(req.session.user, PermissionScope.Restaurant, restaurantId);

    const restaurantAvatarPicKey = `${bucketName}/Restaurants/${restaurantId}/Avatar-${fileName}`;
    const restaurantAvatarPicUrl = await S3Service.generatePutPresignedUrl(restaurantAvatarPicKey);
    return {
      restaurantAvatarPicUrl,
      restaurantAvatarPicKey
    };
  }

  /**
   * Generates a pre-signed URL for uploading an restaurant logo picture to S3.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<S3ValidationError>(422, '4224 S3ValidationError')
  @SuccessResponse(201, 'Restaurant logo pic presigned url generated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/get-res-logo-pic-url')
  public async generatePutRestaurantLogoPicPresignedUrl(
    @Body() body: GetRestaurantPicUrlIn,
    @Request() req: express.Request
  ): Promise<GetRestaurantLogoPicUrlOut> {
    const { restaurantId, fileName } = body;
    const bucketName = process.env.S3_BUCKETNAME;

    this.checkPermission(req.session.user, PermissionScope.Restaurant, restaurantId);

    const restaurantLogoPicKey = `${bucketName}/Restaurants/${restaurantId}/Logo-${fileName}`;
    const restaurantLogoPicUrl = await S3Service.generatePutPresignedUrl(restaurantLogoPicKey);
    return {
      restaurantLogoPicUrl,
      restaurantLogoPicKey
    };
  }

  /**
   * Generates a pre-signed URL for uploading an menu favicon to S3.
   */
  @Response<ForbiddenError>(403, 'Access Denied. You are not authorized to perform this action.')
  @Response<UnauthorizedError>(401, 'Unauthorized user.')
  @Response<S3ValidationError>(422, '4224 S3ValidationError')
  @SuccessResponse(201, 'Menu favicon presigned url generated successfully.')
  @Security('', [RolesEnum.RestaurantOwner])
  @Post('/get-menu-favicon-url')
  public async generatePutMenuFaviconPresignedUrl(
    @Body() body: GetMenuFaviconUrlIn,
    @Request() req: express.Request
  ): Promise<GetMenuFaviconUrlOut> {
    const { restaurantId, menuId, fileName } = body;
    const bucketName = process.env.S3_BUCKETNAME;

    this.checkPermission(req.session.user, PermissionScope.Menu, menuId);

    // Never trust client restaurantId for key prefix — resolve via menu -> branch.
    const menu = await prismaClient.menu.findUnique({
      where: { id: menuId },
      select: { branch: { select: { restaurantId: true } } },
    });
    if (!menu?.branch?.restaurantId || menu.branch.restaurantId !== restaurantId) {
      throw new ForbiddenError();
    }

    const menuFaviconKey = `${bucketName}/Restaurants/${restaurantId}/Menus/${menuId}/Favicon-${fileName}`;
    const menuFaviconUrl = await S3Service.generatePutPresignedUrl(menuFaviconKey);
    return {
      menuFaviconUrl,
      menuFaviconKey
    };
  }
}