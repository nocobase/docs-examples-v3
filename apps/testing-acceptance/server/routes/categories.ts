import { defineRepositoryApiRoutes } from '@nocobase/app-server/router';
// This dictionary is intentionally readable without a session; internalNote never leaves the server.
export default defineRepositoryApiRoutes({
  repositories: [
    {
      name: 'publicCategories',
      collection: 'catalogCategories',
      actions: { findMany: { maxLimit: 50 }, findOne: {}, count: {} },
      policy: {
        read: { scope: true, fields: ['id', 'title'] },
        create: false,
        update: false,
        delete: false,
      },
    },
  ],
});
