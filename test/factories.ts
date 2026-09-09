import { faker } from '@faker-js/faker';
import { randomUUID } from 'crypto';

function uniquePhone(): string {
  // Iranian mobile format expected by validators: 09XXXXXXXXX (11 digits).
  const suffix = Math.floor(100000000 + Math.random() * 900000000).toString();
  return `09${suffix}`;
}

// Legacy factories kept for existing router tests, now unique per call
// (previously static strings caused unique-constraint flakes on reruns).
export const returnUser = () => ({
  phoneNumber: uniquePhone(),
  password: 'P@ssword1234',
  username: `test_user_${randomUUID().slice(0, 8)}`,
  email: `${randomUUID().slice(0, 8)}@example.com`,
});

let categoryNameIndex = 0;
export const returnCategoryName = () => ({
  name: `test-category-name-${categoryNameIndex++}-${randomUUID().slice(0, 6)}`,
});

export const returnRestaurant = () => {
  const tag = randomUUID().slice(0, 8);
  return {
    name: 'Test Restaurant',
    displayName: `test-restaurant-${tag}`,
    slang: 'test-slang',
    instagram: 'some-id',
    telegram: 'some-id',
    twitter: 'some-id',
    youtube: 'some-id',
    eitaa: 'some-id',
  };
};

export const returnItem = () => ({
  name: `some-name-${randomUUID().slice(0, 6)}`,
  ingredients: 'some-ingredients',
  price: 2_000_000,
});

export const returnMenu = () => ({
  name: `test-menu-${randomUUID().slice(0, 6)}`,
  isPublished: false,
});

export const returnCylinder = () => ({
  sat: true,
  sun: false,
  mon: true,
  tue: false,
  wed: true,
  thu: false,
  fri: false,
});

export const returnBranch = () => {
  const tag = randomUUID().slice(0, 8);
  return {
    name: 'Test Branch',
    displayName: `test-branch-${tag}`,
    status: 'test-status',
    showRating: true,
    instagram: 'some-id',
    telegram: 'some-id',
    twitter: 'some-id',
    youtube: 'some-id',
    eitaa: 'some-id',
  };
};

export const returnAddress = () => ({
  country: 'test-country',
  region: 'test-region',
  city: 'test-city',
  area: 'test-area',
  street: 'test-street',
  description: 'test-desc',
});

export const returnOpeningTimes = () => ({
  sat: '08:00-23:00',
  sun: '08:00-23:00',
  mon: '08:00-23:00',
  tue: '08:00-23:00',
  wed: '08:00-23:00',
  thu: '08:00-23:00',
  fri: '08:00-23:00',
});

// New faker-based builders for Phase-3 tests.
export function makeRestaurant() {
  return {
    name: faker.company.name(),
    displayName: `rest-${faker.string.uuid().slice(0, 8)}`,
  };
}

export function makeBranch(restaurantId: string) {
  return {
    restaurantId,
    displayName: `branch-${faker.string.uuid().slice(0, 8)}`,
  };
}

export function makeMenuWithCylinder(branchId: string) {
  return {
    branchId,
    name: `menu-${faker.string.uuid().slice(0, 8)}`,
    cylinder: { sat: true, mon: true },
  };
}

export function makeOrder(menuId: string, itemIds: string[]) {
  return {
    menuId,
    customerEmail: faker.internet.email(),
    items: itemIds.map((itemId) => ({ itemId, amount: 1 })),
  };
}
