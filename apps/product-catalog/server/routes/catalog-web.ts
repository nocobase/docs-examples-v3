import { Hono } from 'hono';
import { html } from 'hono/html';
import { getRequestTranslator, getRequestLocale } from '@nocobase/i18n/server';
import { defineRootRoutes } from '@nocobase/app-server/router';
import type { Application } from '@nocobase/app-server/application';
import { authenticationToken } from '@nocobase/app-plugin-authentication';
import { authorizationToken } from '@nocobase/app-plugin-authorization/server';
import { catalogServiceToken } from '../providers/catalog.js';
import {
  publicProductPolicy,
  ProductSchema,
  type Product,
} from '../providers/catalog-service.js';
import {
  catalogErrorHandler,
  productPolicy,
  type CatalogEnv,
} from './catalog-access.js';

// CSV quoting handles separators/newlines; the prefix keeps names from becoming spreadsheet formulas.
export function csvCell(value: string | number) {
  const text = String(value);
  const safe = /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function toCsv(records: readonly Partial<Product>[]) {
  const rows = records.map((record) => ProductSchema.parse(record));
  return (
    [
      ['id', 'name', 'priceCents', 'published'],
      ...rows.map((p) => [p.id, p.name, p.priceCents, String(p.published)]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\r\n') + '\r\n'
  );
}

export default defineRootRoutes<Application>((app) => {
  const router = new Hono<CatalogEnv>();
  const service = app.container.resolve(catalogServiceToken);
  router.onError(catalogErrorHandler);
  // Public by design: published records and an explicit field whitelist only.
  router.get('/catalog', async (c) => {
    const t = getRequestTranslator(c, app.appName);
    const { data } = await service.list(publicProductPolicy, {
      q: '',
      page: 1,
      pageSize: 50,
    });
    const base = app.publicBasePath;
    c.header('Cache-Control', 'no-store');
    return c.html(
      html`<!doctype html>
        <html lang="${getRequestLocale(c) ?? 'en-US'}">
          <head>
            <meta charset="utf-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />
            <title>${t('catalog.title')}</title>
            <style>
              body {
                font: 16px/1.6 system-ui;
                margin: 0;
                background: Canvas;
                color: CanvasText;
              }
              header,
              main,
              footer {
                max-width: 64rem;
                margin: auto;
                padding: 1.5rem 2rem;
              }
              header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid GrayText;
              }
              nav {
                display: flex;
                gap: 1.5rem;
              }
              a {
                color: LinkText;
              }
              h1 {
                font-size: 2.25rem;
                margin-bottom: 0.5rem;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 2rem 0;
              }
              th,
              td {
                text-align: left;
                padding: 1rem;
                border-bottom: 1px solid GrayText;
              }
              footer {
                font-size: 0.9rem;
              }
              @media (max-width: 600px) {
                header {
                  display: block;
                }
                nav {
                  flex-wrap: wrap;
                }
                header,
                main,
                footer {
                  padding: 1rem;
                }
              }
            </style>
          </head>
          <body>
            <header>
              <strong>${t('catalog.title')}</strong>
              <nav>
                <a href="${base}/">${t('catalog.app')}</a
                ><a href="${base}/api/swagger/docs">${t('catalog.docs')}</a
                ><a href="${base}/catalog/export.csv"
                  >${t('catalog.download')}</a
                >
              </nav>
            </header>
            <main>
              <h1>${t('catalog.heading')}</h1>
              <p>${t('catalog.description')}</p>
              <table>
                <thead>
                  <tr>
                    <th>${t('catalog.product')}</th>
                    <th>${t('catalog.price')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.map(
                    (p) =>
                      html`<tr>
                        <td>${p.name}</td>
                        <td>${(p.priceCents / 100).toFixed(2)}</td>
                      </tr>`,
                  )}
                </tbody>
              </table>
              ${data.length === 0 ? html`<p>${t('catalog.empty')}</p>` : ''}
              <p>${t('catalog.limit')}</p>
            </main>
            <footer>${t('catalog.downloadHint')}</footer>
          </body>
        </html>`,
    );
  });
  // The standalone runtime adds the application mount path to local Location headers.
  router.get('/old-catalog', (c) => c.redirect('/catalog', 302));
  const auth = app.container.resolve(authenticationToken);
  const authz = app.container.resolve(authorizationToken);
  router.use(
    '/catalog/export.csv',
    auth.required({ scopedKeys: false }),
    authz.middleware(),
  );
  router.get('/catalog/export.csv', async (c) => {
    const policy = await productPolicy(c, 'view');
    const records = await service
      .repository(policy)
      .findMany({ limit: 500, sort: (s) => s.field('name').asc() });
    const csv = toCsv(records);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="products.csv"');
    c.header('Cache-Control', 'private, no-store');
    return c.body(csv);
  });
  return new Hono().route('/', router);
});
