import { ErrorDetail } from '../types/ErrorTypes';

export default class MenuchiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: number,
    public details?: ErrorDetail[]
  ) {
    super(message);
  }
}
