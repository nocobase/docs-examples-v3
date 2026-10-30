import { z } from 'zod';
import { deviceCategory, isoDate } from '../devices/schemas.js';

export const requestStates = [
  'draft',
  'pendingApproval',
  'readyToIssue',
  'issued',
  'rejected',
  'withdrawn',
] as const;
export const requestState = z.enum(requestStates);

export const createRequest = z.strictObject({
  category: deviceCategory,
  reason: z.string().trim().min(1).max(500),
  /** Not before the day it is submitted; checked by the service, which knows today's date. */
  neededBy: isoDate.nullable().default(null),
});

export const requestId = z.object({ id: z.uuid() });

export const listRequests = z.object({
  status: requestState.optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** What each action sends; the server adds who did it, and the `Idempotency-Key` header names the attempt. */
export const fireRequest = z.discriminatedUnion('transition', [
  z.strictObject({
    transition: z.literal('approve'),
    input: z
      .strictObject({ decisionComment: z.string().trim().max(500).default('') })
      .default({ decisionComment: '' }),
    expectVersion: z.number().int().min(0).optional(),
  }),
  z.strictObject({
    transition: z.literal('reject'),
    input: z.strictObject({ decisionComment: z.string().trim().max(500) }),
    expectVersion: z.number().int().min(0).optional(),
  }),
  z.strictObject({
    transition: z.literal('issue'),
    input: z.strictObject({ deviceId: z.uuid() }),
    expectVersion: z.number().int().min(0).optional(),
  }),
  z.strictObject({
    transition: z.literal('withdraw'),
    input: z.strictObject({}).default({}),
    expectVersion: z.number().int().min(0).optional(),
  }),
]);

export const rowSchema = z.object({
  id: z.string(),
  requestNo: z.string(),
  requesterId: z.string(),
  category: deviceCategory,
  reason: z.string(),
  neededBy: z.string().nullable(),
  status: requestState,
  needsApproval: z.coerce.boolean(),
  decisionComment: z.string(),
  decidedById: z.string().nullable(),
  deviceId: z.string().nullable(),
  issuedById: z.string().nullable(),
  lifecycleVersion: z.coerce.number(),
  statusChangedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const requestSchema = rowSchema.extend({
  requesterName: z.string().nullable(),
  decidedByName: z.string().nullable(),
  deviceAssetTag: z.string().nullable(),
  statusChangedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type RequestRow = z.infer<typeof rowSchema>;
export type DeviceRequest = z.infer<typeof requestSchema>;
export type RequestState = z.infer<typeof requestState>;
