import { Controller } from 'tsoa';
import { BranchUpdateSession, MenuUpdateSession, RestaurantUpdateSession, SessionUpdate, UserSession } from '../types/AuthTypes';
import { UUID } from '../types/TypeAliases';
import { PermissionScope, SessionUpdateScope, SyncOperations } from '../types/Enums';
import { ForbiddenError } from '../exceptions/AuthError';
import TransformersRedisClient from '../config/TransformersRedisClient';

export default class BaseController extends Controller {
  constructor() {
    super();
  }

  checkPermission(user?: UserSession, by?: PermissionScope, id?: UUID) {
    let isOk: boolean;

    switch (by) {
      case PermissionScope.Restaurant:
        isOk = user?.restaurants?.some((restaurant) => restaurant.id === id) ? true : false;
        break;

      case PermissionScope.Branch:
        isOk = user?.restaurants?.some((restaurant) =>
          restaurant.branches.some((branch) => branch.id === id)
        ) ? true : false;
        break;

      case PermissionScope.Backlog:
        isOk = user?.restaurants?.some((restaurant) =>
          restaurant.branches.some((branch) => branch.backlogId === id)
        ) ? true : false;
        break;

      case PermissionScope.Menu:
        isOk = user?.restaurants?.some((restaurant) =>
          restaurant.branches.some((branch) => 
            branch.menus?.some(menuId => menuId === id)
        )) ? true : false;
        break;

      default:
        isOk = false;
    }
    
    if (!isOk) throw new ForbiddenError();
  }

  updateSession(
    scope: SessionUpdateScope,
    update: SessionUpdate
  ) {
    const { userSession } = update;  
    if (!userSession) return;

    switch (scope) {
      case SessionUpdateScope.Restaurant:
        const restaurantUpdate = update as RestaurantUpdateSession;
        userSession.restaurants?.push({ 
          id: restaurantUpdate.restaurantId, 
          branches: [restaurantUpdate.branch] 
        });
        break;
      
      case SessionUpdateScope.Branch:
        const branchUpdate = update as BranchUpdateSession;
        const res = userSession.restaurants?.find(r => r.id === branchUpdate.restaurantId);
        res?.branches.push({
          id: branchUpdate.branch.id,
          backlogId: branchUpdate.branch.backlogId
        });
        break;
      
      case SessionUpdateScope.Menu:
        const menuUpdate = update as MenuUpdateSession;
        const restaurant = userSession.restaurants?.find(r => r.id === menuUpdate.restaurantId);
        const branch = restaurant?.branches.find(b => b.id === menuUpdate.branchId);

        if (branch) {
          if (!branch.menus) {
            branch.menus = [];
          }
          branch.menus.push(menuUpdate.menuId);
        }
       break;
    }
  }

  async publish(
    streamName = process.env.TRANSFORMERS_STREAM!,
    key?: string | null,
    operation?: SyncOperations,
    oldKey?: string | null) {
      if (key && operation) {
        const event = {
          image_key: key,
          operation
        };
        await TransformersRedisClient.xAdd(streamName, '*', event);
      }
  }
}
