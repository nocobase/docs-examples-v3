import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderAuthenticatedClient } from '../helpers/authenticated-client.js';
import TasksPage from '../../client/pages/tasks/index.js';
import TaskForm from '../../client/pages/tasks/form.js';
import TaskDetail from '../../client/pages/tasks/detail.js';
const routes = (
  <Routes>
    <Route path='/tasks' element={<TasksPage />}>
      <Route path='new' element={<TaskForm />} />
      <Route path='edit/:taskId' element={<TaskForm />} />
      <Route path=':taskId' element={<TaskDetail />} />
    </Route>
  </Routes>
);
describe('task pages with real authentication, authorization and database', () => {
  it('validates a title, saves once, shows it immediately, and preserves a failed draft', async () => {
    let fail = false;
    let writes = 0;
    const view = await renderAuthenticatedClient(routes, {
      route: '/tasks',
      beforeRequest(request) {
        if (request.method === 'POST' && request.url.endsWith('/tasks')) {
          writes++;
          if (fail) throw new TypeError('Deliberate transport failure');
        }
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    await user.click(await screen.findByRole('button', { name: 'Create' }));
    expect(await screen.findByText('Enter a task title.')).toBeVisible();
    expect(writes).toBe(0);
    const title = screen.getByRole('textbox', { name: /Title/u });
    await user.type(title, 'Write the project brief');
    await user.clear(title);
    expect(await screen.findByText('Enter a task title.')).toBeVisible();
    await user.type(title, 'Write the project brief');
    fail = true;
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText(
        'Could not complete this action. Your changes have been kept. Try again.',
      ),
    ).toBeVisible();
    expect(title).toHaveValue('Write the project brief');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Write the project brief' }),
      ).toBeVisible(),
    );
    const response = await view.session.fetch('/tasks');
    expect(await response.json()).toMatchObject({ meta: { total: 1 } });
    expect(writes).toBe(2);
  });
  it('keeps the successful create visible when the following read fails', async () => {
    let created = false;
    await renderAuthenticatedClient(routes, {
      route: '/tasks',
      afterResponse(request, response) {
        if (
          request.method === 'POST' &&
          request.url.endsWith('/tasks') &&
          response.ok
        )
          created = true;
      },
      beforeRequest(request) {
        if (
          created &&
          request.method === 'GET' &&
          /\/tasks\?/u.test(request.url)
        )
          throw new TypeError('Deliberate failed reload');
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    await user.type(
      await screen.findByRole('textbox', { name: /Title/u }),
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
  it('recovers a lost committed response with the same key and creates only one task', async () => {
    let lost = false;
    const keys: (string | null)[] = [];
    const view = await renderAuthenticatedClient(routes, {
      route: '/tasks',
      beforeRequest(request) {
        if (request.method === 'POST' && request.url.endsWith('/tasks'))
          keys.push(request.headers.get('Idempotency-Key'));
      },
      afterResponse(request, response) {
        if (
          !lost &&
          request.method === 'POST' &&
          request.url.endsWith('/tasks') &&
          response.ok
        ) {
          lost = true;
          throw new TypeError('Deliberate lost response after commit');
        }
      },
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'New task' }));
    await user.type(
      await screen.findByRole('textbox', { name: /Title/u }),
      'Recover committed task',
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(
      await screen.findByText(/Your changes have been kept/u),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Recover committed task' }),
      ).toBeVisible(),
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[1]).toBe(keys[0]);
    expect(await (await view.session.fetch('/tasks')).json()).toMatchObject({
      meta: { total: 1 },
    });
  });
  it('does not offer mutations to a real read-only user', async () => {
    await renderAuthenticatedClient(routes, {
      route: '/tasks',
      member: true,
      grants: [
        {
          resource: { type: 'composite', id: 'tasks' },
          actions: [
            {
              action: 'read',
              policy: { type: 'composite', scopes: { tasks: 'allRecords' } },
            },
          ],
        },
      ],
    });
    expect(
      await screen.findByText('Your team’s work starts here'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'New task' }),
    ).not.toBeInTheDocument();
  });
});
