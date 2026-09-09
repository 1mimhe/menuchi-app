import { CompleteOut } from './BaseTypes';
import { OrderStatus } from './Enums';
import { DefaultString, Email, Int, URL, UUID } from './TypeAliases';

export interface CreateOrderCompactIn {
  items: OrderItemCompactIn[];
}

export interface CreateOrderCompleteIn {
  customerEmail: Email;
  items: OrderItemCompactIn[];
}

/**
 *  @minItems 1 at least 1 item is required
 */
interface OrderItemCompactIn {
  itemId: UUID;
  /**
   * @minimum 1 minimum age is 1
   */
  amount: Int;
}

export interface OrderCompleteOut extends CompleteOut {
  menuId: UUID | null;
  customerEmail: Email | null;
  totalPrice: number | null;
  status: OrderStatus | null;
  orderItems: OrderItemCompleteOut[] | null;
}

interface OrderItemCompleteOut extends CompleteOut {
  name?: DefaultString | null;
  pikUrl?: URL | null;
  price?: number | null;
  amount?: Int | null;
  ingredients?: string | null;
}
