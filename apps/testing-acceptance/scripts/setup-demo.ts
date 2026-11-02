import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createStandaloneServer } from '../server/standalone.js';
import { userAdministrationServiceToken } from '@nocobase/app-plugin-authentication/server';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';

if (existsSync('storage/demo.json')) {
  console.log('Demo accounts already exist. See storage/demo.json.');
} else {
  await mkdir('storage', { recursive: true });
  if (!existsSync('config.yml'))
    await writeFile(
      'config.yml',
      JSON.stringify(
        {
          server: { host: '0.0.0.0', port: 13320 },
          app: {
            publicOrigin:
              process.env.APP_PUBLIC_ORIGIN ?? 'http://localhost:13320',
          },
          i18n: { defaultLocale: 'en-US' },
          client: { app: { title: 'Product acceptance' } },
          secrets: {
            keys: [{ version: 1, key: randomBytes(32).toString('hex') }],
          },
          users: {
            initialAdmin: {
              username: 'catalogadmin',
              email: 'admin@example.test',
              password: randomBytes(24).toString('hex'),
            },
          },
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  const server = await createStandaloneServer();
  try {
    await server.application.start();
    const users = server.application.container.resolve(
      userAdministrationServiceToken,
    );
    const authz = server.application.container.resolve(authorizationToken);
    const accounts = [];
    for (const role of ['catalog-editor', 'catalog-viewer']) {
      const email = `${role}@example.test`;
      const password = randomBytes(18).toString('hex');
      const user = await users.create({
        name: role === 'catalog-editor' ? 'Alex Editor' : 'Robin Viewer',
        email,
        password,
      });
      await authz.permissionSets.assign({
        permissionSet: role,
        subject: { type: 'user', id: user.id },
      });
      accounts.push({ role, email, password, id: user.id });
    }
    await writeFile('storage/demo.json', JSON.stringify(accounts, null, 2), {
      mode: 0o600,
    });
    console.log(
      'Created editor and viewer accounts. Credentials are in storage/demo.json.',
    );
  } finally {
    await server.close();
  }
}
