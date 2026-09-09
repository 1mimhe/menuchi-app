import { UUID } from './TypeAliases';

export interface CompleteOut {
  id: UUID;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
