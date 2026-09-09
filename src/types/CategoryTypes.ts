import { CompleteOut } from './BaseTypes';
import { DefaultString, Int, UUID } from './TypeAliases';
import { ItemCompleteOut } from './ItemTypes';

export interface CategoryNameCompactIn {
  name: DefaultString;
}

export interface CategoryNameCompleteOut extends CompleteOut {
  name: DefaultString | null;
}

export interface CategoryNameCompletePlusOut extends CategoryNameCompleteOut {
  categoryId: UUID;
}

export interface CreateCategoryCompactIn {
  categoryNameId: UUID;
}

export interface CategoryCompactOut {
  backlogId: UUID | null;
  categoryNameId?: UUID | null;
  positionInBacklog?: Int | null;
}

export interface CategoryCompleteOut extends CategoryCompactOut, CompleteOut {
  categoryName?: DefaultString | null;
  items?: ItemCompleteOut[] | null;
}
