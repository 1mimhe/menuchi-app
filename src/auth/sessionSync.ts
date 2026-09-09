import {
  BranchUpdateSession,
  MenuUpdateSession,
  RestaurantUpdateSession,
  SessionUpdate,
} from '../types/AuthTypes';
import { SessionUpdateScope } from '../types/Enums';
import { UUID } from '../types/TypeAliases';

/**
 * Session mutation extracted from BaseController.
 * Push paths are deduped (re-login / re-create no longer duplicates entries)
 * and deletions now have a matching removal path (previously push-only,
 * so deleted restaurants/branches/menus stayed in the session forever).
 */
export function applySessionUpdate(scope: SessionUpdateScope, update: SessionUpdate): void {
  const { userSession } = update;
  if (!userSession) return;
  userSession.restaurants ??= [];

  switch (scope) {
    case SessionUpdateScope.Restaurant: {
      const restaurantUpdate = update as RestaurantUpdateSession;
      const exists = userSession.restaurants.some((r) => r.id === restaurantUpdate.restaurantId);
      if (!exists) {
        userSession.restaurants.push({
          id: restaurantUpdate.restaurantId,
          branches: [restaurantUpdate.branch],
        });
      }
      break;
    }

    case SessionUpdateScope.Branch: {
      const branchUpdate = update as BranchUpdateSession;
      const restaurant = userSession.restaurants.find((r) => r.id === branchUpdate.restaurantId);
      if (restaurant && !restaurant.branches.some((b) => b.id === branchUpdate.branch.id)) {
        restaurant.branches.push({
          id: branchUpdate.branch.id,
          backlogId: branchUpdate.branch.backlogId,
        });
      }
      break;
    }

    case SessionUpdateScope.Menu: {
      const menuUpdate = update as MenuUpdateSession;
      const restaurant = userSession.restaurants.find((r) => r.id === menuUpdate.restaurantId);
      const branch = restaurant?.branches.find((b) => b.id === menuUpdate.branchId);
      if (branch) {
        branch.menus ??= [];
        if (!branch.menus.includes(menuUpdate.menuId)) {
          branch.menus.push(menuUpdate.menuId);
        }
      }
      break;
    }
  }
}

function removeId(list: UUID[] | undefined, id: UUID): void {
  if (!list) return;
  const index = list.indexOf(id);
  if (index >= 0) list.splice(index, 1);
}

/** Removal counterparts for deletions — keeps session from going stale. */
export function removeRestaurantFromSession(
  userSession: SessionUpdate['userSession'],
  restaurantId: UUID
): void {
  if (!userSession?.restaurants) return;
  userSession.restaurants = userSession.restaurants.filter((r) => r.id !== restaurantId);
}

export function removeBranchFromSession(
  userSession: SessionUpdate['userSession'],
  restaurantId: UUID,
  branchId: UUID
): void {
  const restaurant = userSession?.restaurants?.find((r) => r.id === restaurantId);
  if (restaurant) {
    restaurant.branches = restaurant.branches.filter((b) => b.id !== branchId);
  }
}

export function removeMenuFromSession(
  userSession: SessionUpdate['userSession'],
  restaurantId: UUID,
  branchId: UUID,
  menuId: UUID
): void {
  const branch = userSession?.restaurants
    ?.find((r) => r.id === restaurantId)
    ?.branches.find((b) => b.id === branchId);
  removeId(branch?.menus, menuId);
}
