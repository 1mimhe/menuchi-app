import { CompleteOut } from './BaseTypes';
import { Boolean, DefaultString, Int, LongString, URL, UUID } from './TypeAliases';

export interface ItemCompactIn {
  categoryNameId: UUID;
  name: DefaultString;
  ingredients?: LongString | null;
  price?: number | null;
  picKey?: LongString | null;
}

export interface CreateItemCompleteOut extends CompleteOut {
  categoryId?: UUID | null;
  categoryName?: DefaultString | null;
  // subCategoryId?: UUID | null;
  name?: DefaultString | null;
  ingredients?: LongString | null;
  price?: number | null;
  picKey?: URL | null;
  positionInItemsList?: Int | null;
  positionInCategory?: Int | null;
}

export interface ItemCompleteOut extends CompleteOut {
  categoryId?: UUID | null;
  categoryNameId?: UUID | null;
  categoryName?: DefaultString | null;
  // subCategoryId?: UUID | null;
  name?: DefaultString | null;
  ingredients?: LongString | null;
  price?: number | null;
  picUrl?: URL | null;
  positionInItemsList?: Int | null;
  positionInCategory?: Int | null;
  positionInMenuCategory?: Int | null;
  isActive?: Boolean | null;
  orderCount?: Int | null;
}

export interface UpdateItemIn {
  categoryId?: UUID | null;
  // subCategoryId?: UUID | null;
  name?: DefaultString | null;
  ingredients?: LongString | null;
  price?: number | null;
  picKey?: LongString | null;
}
