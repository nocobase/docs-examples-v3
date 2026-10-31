import { apiClientToken } from '@nocobase/app-client';
import {
  AuthenticationProvider,
  authenticationClientToken,
} from '@nocobase/app-plugin-authentication/client';
import {
  AuthorizationClient,
  authorizationClientToken,
} from '@nocobase/app-plugin-authorization/client';
import {
  answerApi,
  renderWithApp,
  type ApiCall,
} from '@nocobase/app-testing/client';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { expect, it } from 'vitest';
import CustomersPage from '../../client/pages/customers/index.js';
import enUS from '../../client/locales/en-US.js';
import metadata from '../../package.json' with { type: 'json' };
const customer = {
  id: 'a',
  name: 'Acorn Studio',
  contact: 'Avery',
  email: 'avery@example.test',
  status: 'active',
};
const rows = (name = customer.name) => ({
  data: [{ ...customer, name }],
  meta: { total: 1 },
});
async function renderPage(
  handler: (call: ApiCall) => unknown,
  route = '/customers',
) {
  return renderWithApp(
    <AuthenticationProvider>
      <Routes>
        <Route path='/customers' element={<CustomersPage />} />
      </Routes>
    </AuthenticationProvider>,
    {
      route,
      namespace: metadata.name,
      namespaces: { [metadata.name]: enUS },
      fetch: answerApi((call) =>
        call.path === 'authorization/permissions'
          ? { data: { unrestricted: true, permissions: [] } }
          : handler(call),
      ),
      services(app) {
        app.container.instance(authenticationClientToken, {
          getSession: async () => ({ data: null }),
        });
        app.container.singleton(
          authorizationClientToken,
          (resolver) =>
            new AuthorizationClient(resolver.resolve(apiClientToken)),
        );
      },
    },
  );
}
it('clears previously visible customer records after an actual API 403', async () => {
  let denied = false;
  await renderPage(() =>
    denied
      ? Response.json({ error: { message: 'Forbidden' } }, { status: 403 })
      : rows(),
  );
  expect(
    await screen.findByRole('link', { name: customer.name }),
  ).toBeInTheDocument();
  denied = true;
  await userEvent.click(
    screen.getByRole('button', { name: 'Refresh', exact: true }),
  );
  expect(await screen.findByText(enUS.customers.forbidden)).toBeInTheDocument();
  expect(
    screen.queryByRole('link', { name: customer.name }),
  ).not.toBeInTheDocument();
});
it('keeps a same-query successful result when a refresh fails', async () => {
  let failed = false;
  await renderPage(() =>
    failed
      ? Response.json({ error: { message: 'Unavailable' } }, { status: 503 })
      : rows(),
  );
  await screen.findByRole('link', { name: customer.name });
  failed = true;
  await userEvent.click(
    screen.getByRole('button', { name: 'Refresh', exact: true }),
  );
  await screen.findByText(enUS.customers.failed);
  expect(screen.getByRole('link', { name: customer.name })).toBeInTheDocument();
});
it('does not let an earlier search response replace the current query', async () => {
  const old = Promise.withResolvers<unknown>();
  let oldRequested = false;
  await renderPage(({ query }) => {
    const q = query?.q;
    if (q === 'A') {
      oldRequested = true;
      return old.promise;
    }
    return rows(q === 'Al' ? 'Alpine Goods' : customer.name);
  });
  await screen.findByRole('link', { name: customer.name });
  await userEvent.type(screen.getByLabelText('Search customers'), 'A');
  await userEvent.click(
    screen.getByRole('button', { name: 'Search', exact: true }),
  );
  await waitFor(() => expect(oldRequested).toBe(true));
  await userEvent.type(screen.getByLabelText('Search customers'), 'l');
  await userEvent.click(
    screen.getByRole('button', { name: 'Search', exact: true }),
  );
  await screen.findByRole('link', { name: 'Alpine Goods' });
  await act(async () => {
    old.resolve(rows('Stale result'));
    await old.promise;
  });
  expect(
    screen.queryByRole('link', { name: 'Stale result' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Alpine Goods' }),
  ).toBeInTheDocument();
});
it('clears search and status together without losing page size or sort', async () => {
  const seen: ApiCall[] = [];
  await renderPage((call) => {
    seen.push(call);
    return call.query?.q || call.query?.status !== 'all'
      ? { data: [], meta: { total: 0 } }
      : rows();
  }, '/customers?q=Missing&status=inactive&pageSize=5&sort=name&order=desc');
  await screen.findByText('No results', { exact: true });
  await userEvent.click(
    screen.getByRole('button', { name: 'Clear filters', exact: true }),
  );
  await screen.findByRole('link', { name: customer.name });
  expect(seen.at(-1)?.query).toMatchObject({
    q: '',
    status: 'all',
    pageSize: '5',
    sort: 'name',
    order: 'desc',
  });
});
