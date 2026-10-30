import { z } from 'zod';
export const customerStatus = z.enum(['lead', 'followingUp', 'won']);
export const customerDetails = z.strictObject({
  title: z.string().trim().min(1).max(120),
  contact: z.string().trim().max(255).default(''),
  description: z.string().trim().max(2000).default(''),
  salesOwnerId: z.string().min(1).max(255).nullable().default(null),
  nextFollowUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const date = new Date(`${value}T00:00:00Z`);
      return (
        !Number.isNaN(date.valueOf()) &&
        date.toISOString().slice(0, 10) === value
      );
    })
    .nullable()
    .default(null),
});
export const createCustomer = customerDetails.extend({
  status: customerStatus.default('lead'),
});
export const editCustomer = customerDetails.extend({
  expectedUpdatedAt: z.iso.datetime(),
});
export const progressCustomer = z.strictObject({
  status: customerStatus,
  expectedUpdatedAt: z.iso.datetime(),
});
export const customerId = z.object({ id: z.uuid() });
export const customerVersion = z.object({
  expectedUpdatedAt: z.iso.datetime(),
});
export const listCustomers = z.object({
  q: z.string().trim().max(120).default(''),
  status: customerStatus.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z
    .enum([
      'updatedAt:desc',
      'updatedAt:asc',
      'nextFollowUpDate:asc',
      'nextFollowUpDate:desc',
    ])
    .default('updatedAt:desc'),
});
export const listSalesOwners = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export const rowSchema = customerDetails.extend({
  id: z.string(),
  status: customerStatus,
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export const customerSchema = customerDetails.extend({
  id: z.string(),
  status: customerStatus,
  salesOwnerName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  permissions: z.object({
    edit: z.boolean(),
    progress: z.boolean(),
    delete: z.boolean(),
  }),
});
export type CustomerRow = z.infer<typeof rowSchema>;
export type Customer = z.infer<typeof customerSchema>;
export type CustomerInput = z.infer<typeof createCustomer>;
export type CustomerQuery = z.infer<typeof listCustomers>;
