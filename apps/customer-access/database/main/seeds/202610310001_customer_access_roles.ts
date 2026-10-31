import { defineSeed } from '@nocobase/db';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';
import { encodeAuthorizationTitle, selection } from '@nocobase/authorization/core';
import { accessResource, title } from '../../../server/access/permissions.ts';
export default defineSeed({ name: '202610310001_customer_access_roles', async run({ query }) {
 const own = selection.recordAccess('customerAccess.owned');
 for (const [key, edit] of [['customer-sales', true], ['customer-reader', false]] as const) {
  const role = definePermissionSet(key).title(title(edit ? 'sales' : 'reader'))
   .grant({ resource: { type: 'page', id: 'customerAccess.customers' }, actions: [{ action: 'access' }] })
   .grant({ resource: { type: 'page', id: 'customerAccess.orders' }, actions: [{ action: 'access' }] })
   .grant(accessResource.reference().grant({ viewCustomers: { customers: own }, viewOrders: { orders: own }, ...(edit ? { createCustomer: { customers: own }, editCustomer: { customers: own }, assignCustomer: { orders: own, customers: own } } : {}) })).build();
  if (await query.selectFrom('authorizationPermissionSets').select('id').where('key', '=', key).executeTakeFirst()) continue;
  await query.insertInto('authorizationPermissionSets').values({ id: key, key, title: encodeAuthorizationTitle(role.title), grants: JSON.stringify(role.grants), createdAt: new Date(), updatedAt: new Date() }).execute();
 }
} });
