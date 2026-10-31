import { ApiClientError } from '@nocobase/api-client';
import { z } from 'zod';

const ErrorDetails = z.object({
  error: z.object({
    fieldViolations: z
      .array(
        z.object({
          field: z.string(),
          description: z.string(),
          reason: z.string().optional(),
        }),
      )
      .optional(),
  }),
});

export function errorSummary(error: unknown) {
  if (!(error instanceof ApiClientError)) throw error;
  const details = ErrorDetails.safeParse(error.payload);
  return {
    status: error.status,
    reason: error.reason,
    domain: error.domain,
    requestId: error.requestId,
    fields: details.success
      ? (details.data.error.fieldViolations ?? []).map(({ field, reason }) => ({
          field,
          reason,
        }))
      : [],
  };
}
