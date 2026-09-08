import { UserSession } from '../types/AuthTypes';
import { PermissionScope } from '../types/Enums';
import { UUID } from '../types/TypeAliases';

/**
 * Pure permission check extracted from BaseController.
 * No Express, no session mutation — trivially unit-testable.
 */
export function canAccess(user: UserSession | undefined, by: PermissionScope | undefined, id: UUID | undefined): boolean {
  switch (by) {
    case PermissionScope.Restaurant:
      return user?.restaurants?.some((restaurant) => restaurant.id === id) ?? false;

    case PermissionScope.Branch:
      return user?.restaurants?.some((restaurant) =>
        restaurant.branches.some((branch) => branch.id === id)
      ) ?? false;

    case PermissionScope.Backlog:
      return user?.restaurants?.some((restaurant) =>
        restaurant.branches.some((branch) => branch.backlogId === id)
      ) ?? false;

    case PermissionScope.Menu:
      return user?.restaurants?.some((restaurant) =>
        restaurant.branches.some((branch) =>
          branch.menus?.some(menuId => menuId === id)
        )) ?? false;

    default:
      return false;
  }
}
