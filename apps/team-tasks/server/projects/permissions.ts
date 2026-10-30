import { defineCompositeResource } from '@nocobase/authorization/core';
import { defineDatabasePermission } from '@nocobase/app-plugin-authorization/server';
import metadata from '../../package.json' with { type: 'json' };
import type { ProjectRow } from './schemas.js';
export const label = (key: string) => ({
  ns: metadata.name,
  key: `projects.${key}`,
});
const fields = ['id', 'name', 'createdAt'] as const;
const data = defineDatabasePermission((p) =>
  p.collection<ProjectRow>('projects').title(label('title')).read(fields),
);
export const projectPermissions = defineCompositeResource('projects', (r) =>
  r
    .title(label('title'))
    .action('read', (a) =>
      a.title(label('readPermission')).grant('projects', data),
    )
    .action('create', (a) =>
      a.title(label('createPermission')).grant('projects', data.create(fields)),
    ),
);
