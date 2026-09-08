import { PrismaClient } from '@prisma/client';
import prismaClient from '../db/prisma';
import { UUID } from '../types/TypeAliases';
import { BranchNotFound, RestaurantNotFound } from '../exceptions/NotFoundError';
import { isForeignKeyViolation, isRecordNotFound } from '../utils/prismaErrors';
import { AddressCompactIn, AddressCompleteOut, BranchBySlugCompleteOut, BranchCompletePlusOut, CreateBranchCompactIn, CreateBranchCompleteOut, OpeningTimesCompactIn, OpeningTimesCompleteOut, UpdateBranchCompactIn } from '../types/RestaurantTypes';

export class BranchService {
  constructor(private prisma: PrismaClient = prismaClient) {}

  async createBranch(branch: CreateBranchCompactIn): Promise<CreateBranchCompleteOut | never> {
    return this.prisma.branch.create({
      data: {
        ...branch,
        backlog: {
          create: {}
        }
      },
      include: {
        backlog: true
      }
    }).catch((error: Error) => {
      if (isForeignKeyViolation(error, 'branches_restaurant_id_fkey'))
        throw new RestaurantNotFound();
      throw error;
    });
  }

  async getBranch(branchId: UUID): Promise<BranchCompletePlusOut | never> {
    return this.prisma.branch.findUniqueOrThrow({
      where: {
        id: branchId
      },
      include: {
        backlog: true,
        address: true,
        openingTimes: true
      }
    }).catch((error: Error) => {
      if (isRecordNotFound(error))
        throw new BranchNotFound();
      throw error;
    })
  }

  async getBranchBySlug(slug: string): Promise<BranchBySlugCompleteOut | never> {
    return this.prisma.branch.findFirstOrThrow({
      where: {
        displayName: slug
      },
      include: {
        backlog: true,
        address: true,
        openingTimes: true,
        menus: true
      }
    }).catch((error: Error) => {
      if (isRecordNotFound(error))
        throw new BranchNotFound();
      throw error; 
    });
  }

  async updateBranch(branchId: UUID, branchDTO: UpdateBranchCompactIn) {
    return this.prisma.branch.update({
      where: {
        id: branchId
      },
      data: branchDTO
    });
  }

  async createOrUpdateAddress(branchId: UUID, address: AddressCompactIn): Promise<AddressCompleteOut | never> {
    return this.prisma.address.upsert({
      where: {
        branchId
      },
      update: {
        ...address,
      },
      create: {
        branchId,
        ...address,
      },
    }).catch((error: Error) => {
      if (isForeignKeyViolation(error, 'addresses_branch_id_fkey'))
        throw new BranchNotFound();
      throw error;
    });
  }

  async createOrUpdateOpeningTimes(branchId: UUID, openingTimes: OpeningTimesCompactIn): Promise<OpeningTimesCompleteOut | never> {
    return this.prisma.openingTimes.upsert({
      where: {
        branchId
      },
      update: {
        ...openingTimes,
      },
      create: {
        branchId,
        ...openingTimes,
      },
    }).catch((error: Error) => {
      if (isForeignKeyViolation(error, 'opening_times_branch_id_fkey'))
        throw new BranchNotFound();
      throw error;
    });
  }
}

export default new BranchService();
