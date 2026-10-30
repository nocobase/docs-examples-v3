import path from 'node:path';
import type { MigrationSource } from '@nocobase/db';
import { describeMigration } from '@nocobase/app-testing/server';

const sources: readonly MigrationSource[] = [
  {
    packageName: 'itam-lite-test',
    directory: path.resolve(
      import.meta.dirname,
      '../../database/main/migrations',
    ),
  },
];

describeMigration('202610300201_create_device_requests', {
  sources,
  up: async ({ expectCollection }) => {
    for (const name of [
      'deviceRequests',
      'lifecycleTransitions',
      'lifecycleEffectRuns',
      'lifecycleParameterHeads',
      'lifecycleParameterVersions',
      'lifecycleParameterSelections',
      'lifecycleParameterRequests',
      'lifecycleParameterSnapshots',
      'lifecycleParameterUsages',
    ])
      await expectCollection(name).toExist();
    await expectCollection('deviceRequests').toHaveField('lifecycleVersion', {
      nullable: false,
    });
    await expectCollection('deviceRequests').toHaveField('deviceId', {
      nullable: true,
    });
  },
  down: async ({ expectCollection }) => {
    await expectCollection('deviceRequests').not.toExist();
    await expectCollection('lifecycleTransitions').not.toExist();
  },
});
