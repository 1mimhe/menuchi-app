import MenuchiError from './MenuchiError';

export class NotFoundError extends MenuchiError {
  constructor(message: string = 'Not found error', status: number = 404, code?: number) {
    super(message, status, code);
  }
}

export class BacklogNotFound extends NotFoundError {
  constructor() {
    super('Backlog with the given id not found', 404, 4044);
  }
}

export class CategoryNameNotFound extends NotFoundError {
  constructor() {
    super('Category Name with the given id not found', 404, 4042);
  }
}

export class RestaurantNotFound extends NotFoundError {
  constructor() {
    super('Restaurant with the given id not found', 404, 4041);
  }
}

export class UserNotFound extends NotFoundError {
  constructor() {
    super('User with the given id not found', 404, 4045);
  }
}

export class MenuNotFound extends NotFoundError {
  constructor() {
    super('Menu with the given id not found', 404, 4048);
  }
}

export class CylinderNotFound extends NotFoundError {
  constructor() {
    super('Cylinder with the given id not found', 404, 4046);
  }
}

export class CategoryNotFound extends NotFoundError {
  constructor() {
    super('Category with the given id not found', 404, 40412);
  }
}

export class BranchNotFound extends NotFoundError {
  constructor() {
    super('Branch with the given id not found', 404, 4049);
  }
}

export class ItemNotFound extends NotFoundError {
  constructor() {
    super('Item with the given id not found', 404, 4043);
  }
}
