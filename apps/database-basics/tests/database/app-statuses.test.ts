import { fileURLToPath } from 'node:url';
import {
  createDatabaseTest,
  describeMigration,
} from '@nocobase/app-testing/server';
import { expect } from 'vitest';
import defaults from '../../database/main/seeds/202611040002_default_app_statuses.js';
import metadata from '../../package.json' with { type: 'json' };

const migrations = [
  {
    packageName: metadata.name,
    directory: fileURLToPath(
      new URL('../../database/main/migrations/', import.meta.url),
    ),
  },
];
const seeds = [
  {
    packageName: metadata.name,
    directory: fileURLToPath(
      new URL('../fixtures/app-statuses/seeds/', import.meta.url),
    ),
  },
];
const failingSeeds = [
  {
    packageName: metadata.name,
    directory: fileURLToPath(
      new URL('../fixtures/app-statuses/failing-seeds/', import.meta.url),
    ),
  },
];

describeMigration('202611040001_create_app_statuses', {
  sources: migrations,
  up: async ({ connection, expectCollection }) => {
    await expectCollection('appStatuses').toHaveField('code', {
      type: 'string',
      nullable: false,
    });
    await expectCollection('appStatuses').toHaveField('title', {
      type: 'string',
      nullable: false,
    });
    await connection
      .repository('appStatuses')
      .createOne({ values: { code: 'draft', title: 'Draft' } });
    await expect(
      connection
        .repository('appStatuses')
        .createOne({ values: { code: 'draft', title: 'Duplicate' } }),
    ).rejects.toThrow();
  },
  down: async ({ expectCollection }) => {
    await expectCollection('appStatuses').not.toExist();
  },
});

describeMigration('202611040003_add_app_status_description', {
  sources: migrations,
  before: async ({ connection }) => {
    await connection
      .repository('appStatuses')
      .createOne({ values: { code: 'draft', title: 'Writing' } });
  },
  up: async ({ connection, expectCollection }) => {
    await expectCollection('appStatuses').toHaveField('description', {
      type: 'text',
      nullable: true,
    });
    expect(
      await connection
        .repository('appStatuses')
        .findOne({ filter: { code: 'draft' } }),
    ).toMatchObject({ title: 'Writing', description: null });
  },
  down: async ({ connection, expectCollection }) => {
    await expectCollection('appStatuses').not.toHaveField('description');
    expect(
      await connection
        .repository('appStatuses')
        .findOne({ filter: { code: 'draft' } }),
    ).toMatchObject({ title: 'Writing' });
  },
});

const test = createDatabaseTest({ migrations });

test('installs defaults once and skips successful history', async ({
  database,
  connection,
}) => {
  const seeder = database.createSeeder({ sources: seeds });
  expect((await seeder.run()).executed).toEqual([defaults.name]);
  expect(
    await connection
      .repository('appStatuses')
      .findMany({ sort: (s) => [s.field('code').asc()] }),
  ).toMatchObject([
    { code: 'draft', title: 'Draft', description: null },
    { code: 'published', title: 'Published', description: null },
  ]);
  expect((await seeder.run()).executed).toEqual([]);
  expect(await seeder.history()).toHaveLength(1);
});

test('preserves administrator edits and repeated seed logic adds no duplicates', async ({
  database,
  connection,
}) => {
  const statuses = connection.repository('appStatuses');
  await statuses.createOne({ values: { code: 'draft', title: 'Writing' } });
  await database.createSeeder({ sources: seeds }).run();
  // A separate ledger deliberately reruns the same production seed to test business idempotency.
  await database
    .createSeeder({ sources: seeds, tableName: '__nocobase_status_recheck' })
    .run();
  expect(await statuses.findOne({ filter: { code: 'draft' } })).toMatchObject({
    title: 'Writing',
  });
  expect(await statuses.findMany()).toHaveLength(2);
});

test('rolls back failed seed writes and history, then retries successfully', async ({
  database,
  connection,
}) => {
  let fail = true;
  const seeder = database.createSeeder({
    sources: failingSeeds,
    config: {
      get: <T>(key: string): T | undefined =>
        (key === 'fail' ? fail : undefined) as T | undefined,
    },
  });
  await expect(seeder.run()).rejects.toThrow('Intentional seed failure');
  expect(await connection.repository('appStatuses').findMany()).toHaveLength(0);
  expect(await seeder.history()).toHaveLength(0);
  fail = false;
  expect((await seeder.run()).executed).toEqual([defaults.name]);
  expect(await connection.repository('appStatuses').findMany()).toHaveLength(2);
  expect(await seeder.history()).toHaveLength(1);
});
