import { ApiError } from '@nocobase/app-server/router';
import {
  CustomerUnavailableError,
  OrderLockedError,
  OrderMissingError,
} from '../orders/service.js';

export function toOrderApiError(error: unknown): unknown {
  if (error instanceof CustomerUnavailableError) {
    return new ApiError({
      status: 'INVALID_ARGUMENT',
      reason: 'CUSTOMER_UNAVAILABLE',
      domain: 'orders',
      message: error.message,
      fieldViolations: [
        {
          field: 'customerId',
          reason: 'CUSTOMER_UNAVAILABLE',
          description: 'Choose an available customer.',
        },
      ],
      cause: error,
    });
  }
  if (error instanceof OrderMissingError) {
    return new ApiError({
      status: 'NOT_FOUND',
      reason: 'ORDER_NOT_FOUND',
      domain: 'orders',
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof OrderLockedError) {
    return new ApiError({
      status: 'FAILED_PRECONDITION',
      reason: 'ORDER_LOCKED',
      domain: 'orders',
      message: error.message,
      cause: error,
    });
  }
  return error;
}
