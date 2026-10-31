import { defineSeed } from '@nocobase/db';
import { definePermissionSet } from '@nocobase/authorization/permission-sets';
import { encodeAuthorizationTitle } from '@nocobase/authorization/core';
import { customerResource } from '../../../server/customer-resource.ts';
const page = { resource: {type: 'page', id: 'customers'}, actions: [{action: 'access'}] };
const roles = [
 definePermissionSet('customer-viewer').title({ key: 'customers.viewerRole', ns: 'customer-directory' }).grant(page)
   .grant(customerResource.reference().grant({view: {customers: 'allRecords'}})).build(),
 definePermissionSet('customer-editor').title({ key: 'customers.editorRole', ns: 'customer-directory' }).grant(page)
   .grant(customerResource.reference().grant({view: {customers: 'allRecords'}, create: {customers: 'allRecords'}, edit: {customers: 'allRecords'}, delete: {customers: 'allRecords'}})).build(),
];
export default defineSeed({
 name: '202611040003_customer_roles', transaction: true,
 async run({ query }) {
  for (const role of roles) {
   const existing = await query.selectFrom('authorizationPermissionSets').select('id').where('key','=',role.key).executeTakeFirst();
   if(existing) continue;
   const now = new Date();
   await query.insertInto('authorizationPermissionSets').values({id: role.key, key: role.key, title: encodeAuthorizationTitle(role.title), grants: JSON.stringify(role.grants), createdAt: now, updatedAt: now}).execute();
  }
 }
});
