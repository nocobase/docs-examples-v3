import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderAuthenticatedClient } from '../helpers/authenticated-client.js';
import CustomersPage from '../../client/pages/customers/index.js';
import CustomerForm from '../../client/pages/customers/form.js';
import CustomerDetail from '../../client/pages/customers/detail.js';
const routes = (
  <Routes>
    <Route path='/customers' element={<CustomersPage />}>
      <Route path='new' element={<CustomerForm />} />
      <Route path='edit/:customerId' element={<CustomerForm />} />
      <Route path=':customerId' element={<CustomerDetail />} />
    </Route>
  </Routes>
);
describe('customer pages with real authentication, authorization and database', () => {
  it('validates a title, saves once, shows it immediately, and preserves a failed draft', async () => {
    let fail = false;
    let writes = 0;
    const view = await renderAuthenticatedClient(routes, {
      route: '/customers',
      beforeRequest(request) {
        if (request.method === 'POST' && request.url.endsWith('/customers')) {
          writes++;
          if (fail) throw new TypeError('Deliberate transport failure');
        }
      },
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'New customer' }),
    );
    await user.click(await screen.findByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Enter a customer name.')).toBeVisible();
    expect(writes).toBe(0);
    const title = screen.getByRole('textbox', { name: /Customer name/u });
    await user.type(title, 'Northstar Design');
    await user.clear(title);
    expect(await screen.findByText('Enter a customer name.')).toBeVisible();
    await user.type(title, 'Northstar Design');
    fail = true;
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText(
        'Could not complete this action. Your changes have been kept. Try again.',
      ),
    ).toBeVisible();
    expect(title).toHaveValue('Northstar Design');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Northstar Design' }),
      ).toBeVisible(),
    );
    const response = await view.session.fetch('/customers');
    expect(await response.json()).toMatchObject({ meta: { total: 1 } });
    expect(writes).toBe(2);
  });
  it('keeps the successful create visible when the following read fails', async () => {
    let created = false;
    await renderAuthenticatedClient(routes, {
      route: '/customers',
      afterResponse(request, response) {
        if (
          request.method === 'POST' &&
          request.url.endsWith('/customers') &&
          response.ok
        )
          created = true;
      },
      beforeRequest(request) {
        if (
          created &&
          request.method === 'GET' &&
          /\/customers\?/u.test(request.url)
        )
          throw new TypeError('Deliberate failed reload');
      },
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'New customer' }),
    );
    await user.type(
      await screen.findByRole('textbox', { name: /Customer name/u }),
      'Saved despite failed reload',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Saved despite failed reload' }),
      ).toBeVisible(),
    );
    expect(await screen.findByText(/Your changes were saved/u)).toBeVisible();
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
  it('recovers a lost committed response with the same key and creates only one customer', async () => {
    let lost = false;
    const keys: (string | null)[] = [];
    const view = await renderAuthenticatedClient(routes, {
      route: '/customers',
      beforeRequest(request) {
        if (request.method === 'POST' && request.url.endsWith('/customers'))
          keys.push(request.headers.get('Idempotency-Key'));
      },
      afterResponse(request, response) {
        if (
          !lost &&
          request.method === 'POST' &&
          request.url.endsWith('/customers') &&
          response.ok
        ) {
          lost = true;
          throw new TypeError('Deliberate lost response after commit');
        }
      },
    });
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', { name: 'New customer' }),
    );
    await user.type(
      await screen.findByRole('textbox', { name: /Customer name/u }),
      'Recover committed customer',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText(/Your changes have been kept/u),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Recover committed customer' }),
      ).toBeVisible(),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(await (await view.session.fetch('/customers')).json()).toMatchObject(
      {
        meta: { total: 1 },
      },
    );
  });
  it('does not offer mutations to a real read-only user', async () => {
    await renderAuthenticatedClient(routes, {
      route: '/customers',
      member: true,
      grants: [
        {
          resource: { type: 'composite', id: 'customers' },
          actions: [
            {
              action: 'read',
              policy: {
                type: 'composite',
                scopes: { customers: 'allRecords' },
              },
            },
          ],
        },
      ],
    });
    expect(
      await screen.findByText('Start with your first customer'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'New customer' }),
    ).not.toBeInTheDocument();
  });
  it('keeps a pending search when the status filter changes', async () => {
    await renderAuthenticatedClient(routes, { route: '/customers' });
    const user = userEvent.setup();
    const search = await screen.findByRole('textbox', {
      name: 'Search by name…',
    });
    await user.type(search, 'Northstar');
    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(
      await screen.findByRole('option', { name: 'Following up' }),
    );
    await screen.findByText('No matching customers');
    expect(search).toHaveValue('Northstar');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveTextContent(
      'Following up',
    );
  });
});
