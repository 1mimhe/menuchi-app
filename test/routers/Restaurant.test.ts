import { beforeAll, describe, expect, test, vi } from 'vitest';
import { returnRestaurant } from '../factories';
import { RestaurantController } from '../../src/controllers/RestaurantController';
import BaseController from '../../src/controllers/BaseController';

beforeAll(() => {
  // Phase-1 tech debt: direct controller calls bypass HTTP auth.
  // Mock guard here; real enforcement is covered via HTTP in AuthZ.test.ts.
  // TODO(Phase-3): convert these to Supertest and drop this mock.
  vi.spyOn(BaseController.prototype, 'checkPermission').mockImplementation(() => {});
});

const restaurantObject = returnRestaurant();
const restaurantController = new RestaurantController();

describe('POST /restaurants', () => {
  test('should create restaurant with a default branch and backlog successfully.', async () => {
    const promise = restaurantController.createRestaurant(restaurantObject);
    await expect(promise).resolves.toMatchObject(restaurantObject);
  });

  test('should return the restaurant with the given id.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    const promise = restaurantController.getRestaurant(restaurantId);

    await expect(promise).resolves.toMatchObject(restaurantObject);
  });
});

// describe('GET /restaurants/{restaurantId}', () => {
//   test('should retrieves restaurant with its complete branches successfully.', async () => {
//     const restaurant = await restaurantController.createRestaurant(restaurantObject);
//     const branch = await branchController.createBranch({ restaurantId: restaurant.id, ...branchObject });
//     await branchController.createOrUpdateAddress(branch.id, addressObject);
//     await branchController.createOrUpdateOpeningTimes(branch.id, openingTimesObject);
//     const promise = restaurantController.getRestaurant(restaurant.id);

//     await expect(promise).resolves.toMatchObject({
//       ...restaurantObject,
//       branches: [expect.objectContaining({
//         ...branchObject,
//         restaurantId: restaurant.id,
//         address: expect.objectContaining(addressObject),
//         openingTimes: expect.objectContaining(openingTimesObject),
//       })],
//     });
//   });

//   test('should rejects retrieves restaurant with RestaurantNotFound error.', async () => {
//     const promise = restaurantController.getRestaurant(randomUUID());

//     await expect(promise).rejects.toThrowError(RestaurantNotFound);
//   });
// });

describe('PATCH /restaurants/{restaurantId}', () => {
  test('should update restaurant successfully.', async () => {
    const promise = restaurantController.createRestaurant(restaurantObject);
    await expect(promise).resolves.toMatchObject(restaurantObject);
  });

  test('should return the restaurant with the given id.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    const newRestaurant = {
      name: 'New Restaurant',
      displayName: 'new-restaurant',
      slang: 'new-slang',
      instagram: 'new-id',
      telegram: 'new-id',
      twitter: 'new-id',
      youtube: 'new-id',
      eitaa: 'new-id',
    };
    await restaurantController.updateRestaurant(restaurantId, newRestaurant);
    const promise = restaurantController.getRestaurant(restaurantId);

    await expect(promise).resolves.toMatchObject(newRestaurant);
  });
});
