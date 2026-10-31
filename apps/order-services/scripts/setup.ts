import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createStandaloneServer } from '../server/standalone.js';
import { createFixtures } from './fixtures.js';

if (existsSync('storage/demo.json')) {
  console.log(
    'Demo data already exists. Read storage/demo.json for the original accounts and order IDs.',
  );
} else {
  await mkdir('storage', { recursive: true });
  if (!existsSync('config.yml')) {
    // JSON is valid YAML. Never overwrite an existing application configuration.
    await writeFile(
      'config.yml',
      JSON.stringify(
        {
          server: { host: '0.0.0.0', port: 13210 },
          app: {
            publicOrigin:
              process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:13210',
          },
          secrets: {
            keys: [{ version: 1, key: randomBytes(32).toString('hex') }],
          },
          users: {
            initialAdmin: {
              username: 'orderadmin',
              email: 'admin@example.test',
              password: randomBytes(24).toString('hex'),
            },
          },
          jobs: { default: 'memory' },
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  }
  const server = await createStandaloneServer();
  try {
    const fixtures = await createFixtures(
      server.application,
      randomBytes(18).toString('hex'),
    );
    await writeFile('storage/demo.json', JSON.stringify(fixtures, null, 2), {
      mode: 0o600,
    });
    console.log(
      'Created demo accounts and orders. Credentials and IDs are in storage/demo.json.',
    );
  } finally {
    await server.close();
  }
}
