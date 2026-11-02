import { resolveStandaloneAppRuntime } from '@nocobase/app-server/node';
import runtime from '../../server/runtime.js';
import { createApp } from '../../server/app.js';
import path from 'node:path';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import {
  bindTestAppCommand,
  createTestAppConfig,
  runAppCommand,
} from '@nocobase/app-testing/cli';
import { expect, it } from 'vitest';
import ExportProducts from '../../cli/commands/products/export.js';
import metadata from '../../package.json' with { type: 'json' };
const rootDir = path.resolve(import.meta.dirname, '../..');
const migrations = [
  {
    packageName: metadata.name,
    directory: path.join(rootDir, 'database/main/migrations'),
  },
];
it.each(['export', 'dry-run', 'existing'] as const)(
  'handles %s and releases the test application',
  async (mode) => {
    const config = await createTestAppConfig({
      connections: ['main'],
      config: {
        database: {
          connections: {
            main: { migrations: { autoRun: true, sources: migrations } },
          },
        },
        app: { publicOrigin: 'http://localhost' },
        auth: {
          secret: 'testing-acceptance-secret-at-least-32-characters',
          trustedOrigins: ['http://localhost'],
        },
      },
    });
    try {
      const database = await config.testDatabases.open({ migrations });
      try {
        for (const [id, published] of [
          ['00000000-0000-4000-8000-000000000001', true],
          ['00000000-0000-4000-8000-000000000002', false],
        ] as const)
          await database.connection
            .repository('catalogProducts')
            .createOne({
              values: {
                id,
                name: published ? 'public' : 'draft',
                priceCents: 1200,
                published,
              },
            });
      } finally {
        await database.destroy();
      }
      const file = path.join(config.directory, 'products.json');
      if (mode === 'existing') await writeFile(file, 'keep me');
      const Command = bindTestAppCommand(ExportProducts, {
        rootDir,
        config,
        id: 'app:products:export',
        createApp,
        loadRuntime: () =>
          resolveStandaloneAppRuntime(runtime, {
            rootDir,
            configPath: config.path,
            consoleLogStream: 'stderr',
            env: { APP_STORAGE_DIR: path.join(config.directory, 'storage') },
          }),
      });
      const run = await runAppCommand(Command, [
        '--output',
        file,
        '--json',
        ...(mode === 'dry-run' ? ['--dry-run'] : []),
      ]);
      if (mode === 'existing') {
        expect(run.exitCode).not.toBe(0);
        expect(run.json()).toMatchObject({
          ok: false,
          error: { code: 'EXPORT_WRITE_FAILED' },
        });
        expect(await readFile(file, 'utf8')).toBe('keep me');
      } else {
        expect(run.exitCode ?? 0).toBe(0);
        expect(run.json()).toMatchObject({
          ok: true,
          result: { count: 1, written: mode === 'export' },
        });
        if (mode === 'export')
          expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([
            {
              id: '00000000-0000-4000-8000-000000000001',
              name: 'public',
              priceCents: 1200,
              published: true,
            },
          ]);
        else
          expect(await readdir(config.directory)).not.toContain(
            'products.json',
          );
      }
    } finally {
      await config.dispose();
    }
  },
);
