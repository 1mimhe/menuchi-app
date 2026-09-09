export enum RolesEnum {
  Admin = 'ADMIN',
  RestaurantOwner = 'RESTAURANT_OWNER',
  RestaurantCustomer = 'RESTAURANT_CUSTOMER',
}

export enum CookieNames {
  SessionId = 'session-id',
  AccessToken = 'access-token',
}

export enum PermissionScope {
  Restaurant,
  Branch,
  Backlog,
  Menu,
}

export enum SessionUpdateScope {
  Restaurant,
  Branch,
  Menu,
}

export enum OrderStatus {
  Pending = 'PENDING',
  Canceled = 'CANCELED',
  Preparing = 'PREPARING',
  Ready = 'READY',
  Done = 'DONE',
}

export enum Days {
  Saturday = 'sat',
  Sunday = 'sun',
  Monday = 'mon',
  Tuesday = 'tue',
  Wednesday = 'wed',
  Thursday = 'thu',
  Friday = 'fri',
}

export enum SyncOperations {
  Created = 'CREATED',
  Updated = 'UPDATED',
  Deleted = 'DELETED',
}
