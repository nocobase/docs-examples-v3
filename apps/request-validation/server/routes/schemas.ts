import { z } from 'zod';
import type { OrderView } from '../orders/service.js';

export const OrderParams = z.object({ id: z.uuid() });
export const ListOrdersQuery = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
const OrderItemInput = z.strictObject({
  name: z.string().trim().min(1).max(120),
  quantity: z.number().int().min(1).max(1000),
});
export const CreateOrderInput = z.strictObject({
  customerId: z.uuid(),
  reference: z.string().trim().min(1).max(120),
  items: z.array(OrderItemInput).min(1).max(20),
  note: z.string().trim().max(500).nullable().optional(),
});
export const UpdateOrderInput = CreateOrderInput.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Provide at least one field to update.' },
);
export const Order: z.ZodType<OrderView> = z
  .object({
    id: z.uuid(),
    customerId: z.uuid(),
    reference: z.string(),
    items: z.array(z.object({ name: z.string(), quantity: z.number().int() })),
    note: z.string().nullable(),
    status: z.enum(['draft', 'confirmed']),
  })
  .meta({ ref: 'OrdersOrder' });
export const OrderListMeta = z.object({
  total: z.number().int(),
  page: z.number().int(),
  pageSize: z.number().int(),
});
