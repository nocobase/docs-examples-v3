import path from 'node:path';
import type { MigrationSource } from '@nocobase/db';
import { describeMigration } from '@nocobase/app-testing/server';
import { expect } from 'vitest';

const sources: readonly MigrationSource[] = [
  {
    packageName: 'itam-lite-test',
    directory: path.resolve(
      import.meta.dirname,
      '../../database/main/migrations',
    ),
  },
];

const device = (id: string, assetTag: string, serialNumber: string | null) => ({
  id,
  assetTag,
  name: 'Dell U2723QE',
  category: 'monitor',
  serialNumber,
  status: 'inStock',
  location: '',
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
});

describeMigration('202610300101_create_devices', {
  sources,
  up: async ({ connection, expectCollection }) => {
    await expectCollection('devices').toExist();
    await expectCollection('devices').toHaveField('assigneeId', {
      nullable: true,
    });
    await connection.query
      .insertInto('devices')
      .values(device('a', 'IT-1', 'SN-1'))
      .execute();
    // Asset tags are unique from the first version; serial numbers only after 202610300102.
    await expect(
      connection.query
        .insertInto('devices')
        .values(device('b', 'IT-1', 'SN-2'))
        .execute(),
    ).rejects.toThrow();
    await connection.query
      .insertInto('devices')
      .values(device('c', 'IT-2', 'SN-1'))
      .execute();
  },
  down: async ({ expectCollection }) => {
    await expectCollection('devices').not.toExist();
  },
});

describeMigration('202610300102_add_device_serial_number_unique', {
  sources,
  up: async ({ connection }) => {
    // `up` runs twice (apply, roll back, apply again); start each run from an empty table.
    await connection.query
      .deleteFrom('devices')
      .where('id', 'in', ['a', 'b', 'c'])
      .execute();
    await connection.query
      .insertInto('devices')
      .values(device('a', 'IT-1', 'SN-1'))
      .execute();
    await connection.query
      .insertInto('devices')
      .values(device('b', 'IT-2', null))
      .execute();
    await connection.query
      .insertInto('devices')
      .values(device('c', 'IT-3', null))
      .execute();
    await expect(
      connection.query
        .insertInto('devices')
        .values(device('d', 'IT-4', 'SN-1'))
        .execute(),
    ).rejects.toThrow();
  },
  down: async ({ connection }) => {
    // Without the unique index the same serial number is accepted again; remove the rows so the re-apply succeeds.
    await connection.query
      .insertInto('devices')
      .values(device('e', 'IT-5', 'SN-9'))
      .execute();
    await connection.query
      .insertInto('devices')
      .values(device('f', 'IT-6', 'SN-9'))
      .execute();
    await connection.query
      .deleteFrom('devices')
      .where('serialNumber', '=', 'SN-9')
      .execute();
  },
});
