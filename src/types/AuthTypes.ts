import { RolesEnum } from './Enums';
import { Email, IranPhoneNumber, OTP, Username, UUID } from './TypeAliases';

export interface UserLogin {
  phoneNumber: IranPhoneNumber;
  password: string;
}

export interface JWTPayload {
  userId: UUID | Email;
  roles: RolesEnum[];
}

export interface ExpressSession {
  accessToken: string;
  user: UserSession;
}

export interface UserSession {
  id: UUID | Email;
  username?: Username | null;
  phoneNumber?: IranPhoneNumber | null;
  restaurants?: RestaurantSession[];
  recentlyOrderIds?: UUID[];
}

export interface RestaurantSession {
  id?: UUID;
  branches: BranchSession[];
}

export interface BranchSession {
  id?: UUID;
  backlogId?: UUID;
  menus?: UUID[];
}

interface BaseUpdateSession {
  userSession: UserSession;
}

export interface RestaurantUpdateSession extends BaseUpdateSession {
  restaurantId: UUID;
  branch: BranchSession;
}

// Alias (not an extension): branch updates carry the same shape as restaurant
// updates. Kept as a named alias for SessionUpdateScope readability.
export type BranchUpdateSession = RestaurantUpdateSession;

export interface MenuUpdateSession extends BaseUpdateSession {
  restaurantId: UUID;
  branchId: UUID;
  menuId: UUID;
}

export type SessionUpdate = RestaurantUpdateSession | MenuUpdateSession;

export interface SendOtpIn {
  email: Email;
}

export interface CheckOtpIn {
  email: Email;
  code: OTP;
}
