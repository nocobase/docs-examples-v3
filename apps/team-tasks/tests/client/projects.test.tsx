import { expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderAuthenticatedClient } from '../helpers/authenticated-client.js';
import ProjectsPage from '../../client/pages/projects/index.js';
import NewProjectPage from '../../client/pages/projects/new.js';

it('validates the name and recovers a lost response without creating a second project', async () => {
  let lost = false;
  const keys: (string | null)[] = [];
  const view = await renderAuthenticatedClient(
    <Routes>
      <Route path='/projects' element={<ProjectsPage />}>
        <Route path='new' element={<NewProjectPage />} />
      </Route>
    </Routes>,
    {
      route: '/projects',
      beforeRequest(request) {
        if (request.method === 'POST' && request.url.endsWith('/projects'))
          keys.push(request.headers.get('Idempotency-Key'));
      },
      afterResponse(request, response) {
        if (
          !lost &&
          request.method === 'POST' &&
          request.url.endsWith('/projects') &&
          response.ok
        ) {
          lost = true;
          throw new TypeError('Deliberate lost response after commit');
        }
      },
    },
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'New project' }));
  await user.click(screen.getByRole('button', { name: 'Create' }));
  expect(
    await screen.findByText(
      'Enter a project name between 1 and 120 characters.',
    ),
  ).toBeVisible();
  expect(keys).toHaveLength(0);
  const name = screen.getByRole('textbox', { name: /Project name/u });
  await user.type(name, 'Website launch');
  await user.click(screen.getByRole('button', { name: 'Create' }));
  expect(
    await screen.findByText(
      'The project could not be confirmed as saved. Retry with the same name.',
    ),
  ).toBeVisible();
  expect(name).toHaveValue('Website launch');
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() =>
    expect(screen.getByRole('cell', { name: 'Website launch' })).toBeVisible(),
  );
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect(await (await view.session.fetch('/projects')).json()).toMatchObject({
    meta: { total: 1 },
  });
});
