import { setTimeout } from 'node:timers/promises';
import {
  ApiError,
  apiValidator,
  defineApiRoutes,
  describeRoute,
  dataResponse,
  apiErrorResponse,
} from '@nocobase/app-server/router';
import { Hono } from 'hono';
import { z } from 'zod';
import { DemoProducts } from '../providers/demo-products.js';

const Product = z.object({ id: z.string(), sku: z.string(), name: z.string() });
export function createDemoProductsRouter() {
  const records = new DemoProducts();
  const router = new Hono();
  // Intentionally public, disposable demo data only: three fixed records, no database or user data.
  // Each router/application owns its own store. Do not mount this contribution in a production catalog.
  router.get(
    '/clientServiceProducts',
    describeRoute({
      tags: ['Client services demo'],
      summary: 'Read the disposable product catalog',
      operationId: 'listClientServiceProducts',
      security: [],
      responses: { '200': dataResponse(z.array(Product)) },
    }),
    (c) => c.json({ data: records.list() }),
  );
  router.patch(
    '/clientServiceProducts/:id',
    describeRoute({
      tags: ['Client services demo'],
      summary: 'Rename a disposable product',
      operationId: 'renameClientServiceProduct',
      security: [],
      responses: {
        '200': dataResponse(Product),
        '404': apiErrorResponse(404),
        '503': apiErrorResponse(503),
      },
    }),
    apiValidator('param', z.object({ id: z.enum(['lamp', 'chair', 'shelf']) })),
    apiValidator('json', z.object({ name: z.string().trim().min(1).max(80) })),
    async (c) => {
      const mode = c.req.header('x-demo-mode');
      if (mode === 'fail')
        throw new ApiError({
          status: 'UNAVAILABLE',
          reason: 'DEMO_FAILURE',
          domain: 'client-services-demo',
          message: 'Demonstration request failure.',
        });
      const product = records.rename(
        c.req.valid('param').id,
        c.req.valid('json').name,
      );
      // Commit before delaying the response so cancellation visibly does not undo a server change.
      if (mode === 'slow') await setTimeout(3000);
      return c.json({ data: product });
    },
  );
  return router;
}
export default defineApiRoutes(() => createDemoProductsRouter());
