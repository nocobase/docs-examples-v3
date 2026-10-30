import { defineSeed } from '@nocobase/db';

// docs/design.md §6: an employee sees only the devices assigned to them and the requests they submitted, and withdraws
// only their own. The first version of the Employee role (202610300202_itam_roles) reached all records. This seed
// narrows it once, and only when the role still holds exactly what that seed wrote: a role an administrator has
// already changed under Permission management is left as it is. Self-contained: no evolving declarations imported.
const scoped = (action: string, scopes: Record<string, string>) => ({
  action,
  policy: { type: 'composite', scopes },
});

const firstVersion = [
  { resource: { type: 'page', id: 'devices' }, actions: [{ action: 'access' }] },
  { resource: { type: 'page', id: 'requests' }, actions: [{ action: 'access' }] },
  { resource: { type: 'composite', id: 'devices' }, actions: [scoped('read', { devices: 'allRecords' })] },
  {
    resource: { type: 'composite', id: 'deviceRequests' },
    actions: ['read', 'create', 'withdraw'].map((action) => scoped(action, { deviceRequests: 'allRecords' })),
  },
];

const ownRecords = [
  firstVersion[0],
  firstVersion[1],
  { resource: { type: 'composite', id: 'devices' }, actions: [scoped('read', { devices: 'devices.assigned' })] },
  {
    resource: { type: 'composite', id: 'deviceRequests' },
    actions: [
      scoped('read', { deviceRequests: 'deviceRequests.mine' }),
      scoped('create', { deviceRequests: 'allRecords' }),
      scoped('withdraw', { deviceRequests: 'deviceRequests.mine' }),
    ],
  },
];

export default defineSeed({
  name: '202610300301_employee_own_records',
  transaction: true,
  async run({ query }) {
    const row = await query
      .selectFrom('authorizationPermissionSets')
      .select(['id', 'grants'])
      .where('key', '=', 'employee')
      .executeTakeFirst<{ id: string; grants: unknown }>();
    if (!row) return;
    // The first seed stored the grants as JSON text; read through any layer of encoding the driver leaves.
    let grants: unknown = row.grants;
    while (typeof grants === 'string') grants = JSON.parse(grants);
    if (JSON.stringify(grants) !== JSON.stringify(firstVersion)) return;
    await query
      .updateTable('authorizationPermissionSets')
      .set({ grants: JSON.stringify(ownRecords), updatedAt: new Date() })
      .where('id', '=', row.id)
      .execute();
  },
});
