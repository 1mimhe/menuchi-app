import { beforeAll, describe, expect, test, vi } from 'vitest';
import { returnAddress, returnBranch, returnOpeningTimes, returnRestaurant } from '../factories';
import { RestaurantController } from '../../src/controllers/RestaurantController';
import { BranchController } from '../../src/controllers/BranchController';
import BaseController from '../../src/controllers/BaseController';
import { BranchNotFound, RestaurantNotFound } from '../../src/exceptions/NotFoundError';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

beforeAll(() => {
  // Phase-1 tech debt: direct controller calls bypass HTTP auth.
  // Mock guard here; real enforcement is covered via HTTP in AuthZ.test.ts.
  // TODO(Phase-3): convert these to Supertest and drop this mock.
  vi.spyOn(BaseController.prototype, 'checkPermission').mockImplementation(() => {});
});

const restaurantObject = returnRestaurant();
const branchObject = returnBranch();
const addressObject = returnAddress();
const openingTimesObject = returnOpeningTimes();
const restaurantController = new RestaurantController();
const branchController = new BranchController();

describe('POST /branches', () => {
  test('should create branch successfully.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    const promise = branchController.createBranch({ restaurantId, ...branchObject });

    await expect(promise).resolves.toMatchObject({ restaurantId, ...branchObject });
  });

  test('should rejects create branch with RestaurantNotFound error.', async () => {
    const promise = branchController.createBranch({ restaurantId: randomUUID(), ...branchObject });

    await expect(promise).rejects.toThrowError(RestaurantNotFound);
  });

  test('should rejects create branch with constraint error.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    await branchController.createBranch({ restaurantId, ...branchObject });
    const promise = branchController.createBranch({ restaurantId, ...branchObject });

    await expect(promise).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });
});

describe('GET /branches/{branchId}', () => {
  test('should retrieves branch successfully.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    const branch = await branchController.createBranch({ restaurantId, ...branchObject });
    const address = await branchController.createOrUpdateAddress(branch.id, addressObject);
    const openingTimes = await branchController.createOrUpdateOpeningTimes(
      branch.id,
      openingTimesObject
    );
    const promise = branchController.getBranch(branch.id);

    await expect(promise).resolves.toMatchObject({
      ...branch,
      address,
      openingTimes,
    });
  });

  test('should rejects retrieves branch with BranchNotFound error.', async () => {
    const promise = branchController.getBranch(randomUUID());

    await expect(promise).rejects.toThrowError(BranchNotFound);
  });
});

// TODO: test GET /branches/{branchId}/by-slug/{slug}

describe('PATCH /branches', () => {
  test('should updates branch successfully.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    const { id: branchId } = await branchController.createBranch({ restaurantId, ...branchObject });
    const newBranch = {
      name: 'New Branch',
      displayName: 'new-name',
      status: 'new-status',
      showRating: true,
      instagram: 'new-id',
      telegram: 'new-id',
      twitter: 'new-id',
      youtube: 'new-id',
      eitaa: 'new-id',
    };
    await branchController.updateBranch(branchId, newBranch);
    const promise = branchController.getBranch(branchId);

    await expect(promise).resolves.toMatchObject(newBranch);
  });

  test('should rejects updates branch with constraint error.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    await branchController.createBranch({ restaurantId, ...branchObject });
    const newBranch = {
      name: 'New Branch',
      displayName: 'new-name',
      status: 'new-status',
      showRating: true,
      instagram: 'new-id',
      telegram: 'new-id',
      twitter: 'new-id',
      youtube: 'new-id',
      eitaa: 'new-id',
    };
    const { id: branchId } = await branchController.createBranch({ restaurantId, ...newBranch });
    const promise = branchController.updateBranch(branchId, {
      displayName: branchObject.displayName,
    });

    await expect(promise).rejects.toThrowError(Prisma.PrismaClientKnownRequestError);
  });
});

describe('POST /branches/{branchId}/address', () => {
  test('should create address successfully.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    const { id: branchId } = await branchController.createBranch({ restaurantId, ...branchObject });
    const promise = branchController.createOrUpdateAddress(branchId, addressObject);

    await expect(promise).resolves.toMatchObject(addressObject);
  });

  test('should rejects create address with BranchNotFound error.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    await branchController.createBranch({ restaurantId, ...branchObject });
    const promise = branchController.createOrUpdateAddress(randomUUID(), addressObject);

    await expect(promise).rejects.toThrowError(BranchNotFound);
  });
});

describe('POST /branches/{branchId}/opening-times', () => {
  test('should create opening times successfully.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    const { id: branchId } = await branchController.createBranch({ restaurantId, ...branchObject });
    const promise = branchController.createOrUpdateOpeningTimes(branchId, openingTimesObject);

    await expect(promise).resolves.toMatchObject(openingTimesObject);
  });

  test('should rejects create opening times with BranchNotFound error.', async () => {
    const { id: restaurantId } = await restaurantController.createRestaurant(restaurantObject);
    await branchController.createBranch({ restaurantId, ...branchObject });
    const promise = branchController.createOrUpdateOpeningTimes(randomUUID(), openingTimesObject);

    await expect(promise).rejects.toThrowError(BranchNotFound);
  });
});
