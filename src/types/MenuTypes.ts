import { CompleteOut } from './BaseTypes';
import { Days } from './Enums';
import { ItemCompleteOut } from './ItemTypes';
import { BranchCompleteOut } from './RestaurantTypes';
import { Boolean, DefaultString, Int, UUID } from './TypeAliases';

export interface CreateMenuCompactIn extends MenuCompactIn {
  branchId: UUID;
}

export interface MenuCompactIn {
  name?: DefaultString | null;
  favicon?: DefaultString | null;
  isPublished?: Boolean | null;
}

export interface MenuCompleteOut extends CompleteOut {
  branchId: UUID | null;
  name: DefaultString | null;
  favicon: DefaultString | null;
  isPublished: Boolean | null;
}

export interface MenuCompeteWithResIdOut extends MenuCompleteOut {
  restaurantId?: DefaultString | null;
}

export interface MenuCompleteWithCountsOut extends MenuCompleteOut {
  cylindersCount: Int;
  categoriesCount: Int;
  itemsCount: Int;
}

export interface CreateMenuCompleteOut extends CompleteOut {
  branchId: UUID | null;
  name: DefaultString | null;
  favicon: DefaultString | null;
  isPublished: Boolean | null;
}

export interface CylinderCompactIn {
  sat?: Boolean | null;
  sun?: Boolean | null;
  mon?: Boolean | null;
  tue?: Boolean | null;
  wed?: Boolean | null;
  thu?: Boolean | null;
  fri?: Boolean | null;
}

export interface CreateCylinderCompleteOut extends CompleteOut, CylinderCompactIn {
  positionInMenu: Int | null;
}

export interface MenuCategoryCompactIn {
  categoryId: UUID;
  cylinderId: UUID;
  items: UUID[];
}

export interface CreateMenuCategoryCompleteOut extends CompleteOut {
  categoryId: UUID | null;
  cylinderId: UUID | null;
  positionInCylinder: Int | null;
}

interface CylinderCompleteOut extends CompleteOut {
  days: (Boolean | null)[];
  menuCategories: MenuCategoryCompleteOut[] | null;
  positionInMenu: Int | null;
}

export interface MenuCategoryCompleteOut extends CreateMenuCategoryCompleteOut {
  categoryName?: DefaultString | null;
  items?: ItemCompleteOut[] | null;
}

export interface MenuCompletePlusOut extends MenuCompleteOut {
  cylinders: CylinderCompleteOut[] | null;
}

export interface OwnerPreviewCompactOut {
  sat?: MenuCategoryCompleteOut[];
  sun?: MenuCategoryCompleteOut[];
  mon?: MenuCategoryCompleteOut[];
  tue?: MenuCategoryCompleteOut[];
  wed?: MenuCategoryCompleteOut[];
  thu?: MenuCategoryCompleteOut[];
  fri?: MenuCategoryCompleteOut[];
}

export interface MenuPreviewCompleteOut extends OwnerPreviewCompactOut, MenuCompleteOut {}

export interface MenuViewCompleteOut extends MenuCompleteOut {
  currentDay: Days;
  branch?: BranchCompleteOut | null;
  menuCategories: MenuCategoryCompleteOut[];
}