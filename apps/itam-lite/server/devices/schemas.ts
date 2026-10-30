import { z } from 'zod';

export const deviceCategories = [
  'laptop',
  'desktop',
  'monitor',
  'phone',
  'accessory',
] as const;
export const deviceStatuses = [
  'inStock',
  'inUse',
  'inRepair',
  'retired',
] as const;
export const deviceCategory = z.enum(deviceCategories);
export const deviceStatus = z.enum(deviceStatuses);

/** A calendar date, `YYYY-MM-DD`, with no time or time zone. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  });

/** What a person types into the device form. The assignee rule (in use ⇔ has an assignee) is checked by the service. */
export const deviceInput = z.strictObject({
  assetTag: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  category: deviceCategory,
  serialNumber: z
    .string()
    .trim()
    .max(80)
    .nullable()
    .default(null)
    .transform((value) => value || null),
  status: deviceStatus.default('inStock'),
  assigneeId: z.string().min(1).max(255).nullable().default(null),
  location: z.string().trim().max(120).default(''),
  purchaseDate: isoDate.nullable().default(null),
  notes: z.string().trim().max(2000).default(''),
});

export const deviceId = z.object({ id: z.uuid() });

export const listDevices = z.object({
  q: z.string().trim().max(120).default(''),
  status: deviceStatus.optional(),
  category: deviceCategory.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  orderBy: z
    .enum(['updatedAt:desc', 'updatedAt:asc', 'assetTag:asc', 'assetTag:desc'])
    .default('updatedAt:desc'),
});

export const listPeople = z.object({
  q: z.string().trim().max(120).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const rowSchema = z.object({
  id: z.string(),
  assetTag: z.string(),
  name: z.string(),
  category: deviceCategory,
  serialNumber: z.string().nullable(),
  status: deviceStatus,
  assigneeId: z.string().nullable(),
  location: z.string(),
  purchaseDate: z.string().nullable(),
  notes: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const deviceSchema = rowSchema.extend({
  assigneeName: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  permissions: z.object({ edit: z.boolean(), delete: z.boolean() }),
});

export type DeviceRow = z.infer<typeof rowSchema>;
export type Device = z.infer<typeof deviceSchema>;
export type DeviceInput = z.infer<typeof deviceInput>;
export type DeviceQuery = z.infer<typeof listDevices>;
export type DeviceCategory = z.infer<typeof deviceCategory>;
