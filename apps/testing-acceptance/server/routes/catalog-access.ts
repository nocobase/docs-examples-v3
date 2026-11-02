import type { Context } from 'hono';
import { ApiError, apiErrorHandler } from '@nocobase/app-server/router';
import type { AuthEnv } from '@nocobase/app-plugin-authentication';
import type { AuthorizationEnv } from '@nocobase/app-plugin-authorization/server';
import {
  ProductAlreadyPublished,
  ProductNotFound,
} from '../providers/catalog-service.js';
export type CatalogEnv = AuthEnv & AuthorizationEnv;
export async function productPolicy(
  c: Context<CatalogEnv>,
  action: 'view' | 'create' | 'publish',
) {
  const decision = await c
    .get('authz')
    .authorize({ resource: { type: 'composite', id: 'catalog' }, action });
  const policy = decision.conditions?.database?.catalogProducts;
  if (decision.effect === 'deny' || !policy)
    throw new ApiError({
      status: 'PERMISSION_DENIED',
      reason: 'CATALOG_ACTION_DENIED',
      domain: 'catalog',
      message: 'This catalog action is not allowed.',
    });
  return policy;
}
export function catalogErrorHandler(error: Error, c: Context) {
  return apiErrorHandler(
    error instanceof ProductNotFound
      ? new ApiError({
          status: 'NOT_FOUND',
          reason: 'PRODUCT_NOT_FOUND',
          domain: 'catalog',
          message: error.message,
        })
      : error instanceof ProductAlreadyPublished
        ? new ApiError({
            status: 'ALREADY_EXISTS',
            reason: 'PRODUCT_ALREADY_PUBLISHED',
            domain: 'catalog',
            message: error.message,
          })
        : error,
    c,
  );
}
