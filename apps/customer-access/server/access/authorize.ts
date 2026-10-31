import type { Context } from 'hono';
import { ApiError } from '@nocobase/app-server/router';
import type { AuthEnv } from '@nocobase/app-plugin-authentication';
import type { AuthorizationEnv } from '@nocobase/app-plugin-authorization/server';
import type { RepositoryPolicy } from '@nocobase/db';
import type { AccessAction } from './permissions.js';
export type AccessEnv = AuthEnv & AuthorizationEnv;
export async function authorizeAccess(
  c: Context<AccessEnv>,
  action: AccessAction,
) {
  const decision = await c.get('authz').authorize({
    resource: { type: 'composite', id: 'customerAccess' },
    action,
  });
  const database = decision.conditions?.database;
  const required =
    action === 'assignCustomer'
      ? ['accessOrders', 'accessCustomers']
      : action === 'viewOrders'
        ? ['accessOrders']
        : ['accessCustomers'];
  if (
    decision.effect === 'deny' ||
    required.some((name) => !database?.[name]?.read)
  )
    throw new ApiError({
      status: 'PERMISSION_DENIED',
      reason: 'CUSTOMER_ACCESS_DENIED',
      domain: 'customer-access',
      message: 'This operation is not allowed.',
    });
  return database as Record<string, RepositoryPolicy>;
}
