import { ImageFilename, LongString, URL, UUID } from './TypeAliases';

export interface GetItemPicUrlIn {
  restaurantId: UUID;
  branchId: UUID;
  fileName: ImageFilename;
}

export interface GetItemPicUrlOut {
  itemPicUrl: URL;
  itemPicKey: LongString;
}

export interface GetRestaurantPicUrlIn {
  restaurantId: UUID;
  fileName: ImageFilename;
}

export interface GetRestaurantCoverPicUrlOut {
  restaurantCoverPicUrl: URL;
  restaurantCoverPicKey: LongString;
}

export interface GetRestaurantAvatarPicUrlOut {
  restaurantAvatarPicUrl: URL;
  restaurantAvatarPicKey: LongString;
}

export interface GetRestaurantLogoPicUrlOut {
  restaurantLogoPicUrl: URL;
  restaurantLogoPicKey: LongString;
}

export interface GetMenuFaviconUrlIn {
  restaurantId: UUID;
  branchId: UUID;
  menuId: UUID;
  fileName: ImageFilename;
}

export interface GetMenuFaviconUrlOut {
  menuFaviconUrl: URL;
  menuFaviconKey: LongString;
}
