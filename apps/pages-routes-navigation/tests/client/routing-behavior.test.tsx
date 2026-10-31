import { apiClientToken, NavigationGuardProvider } from '@nocobase/app-client';
import {
  AuthorizationClient,
  authorizationClientToken,
} from '@nocobase/app-plugin-authorization/client';
import { renderWithApp, answerApi } from '@nocobase/app-testing/client';
import { PageBreadcrumbProvider } from '@nocobase/app-client';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation, useNavigate } from 'react-router';
import { describe, expect, it } from 'vitest';
import { renderRouteTree } from '../../client/routing/route-tree.js';
import { Routes } from 'react-router';
import { resolveDemoRoutes } from './routing-fixture.js';
import enUS from '../../client/locales/en-US.js';
function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid='location'>
        {location.pathname}
        {location.search}
      </output>
      <button
        data-testid='navigate-away'
        onClick={() => void navigate('/reports/owners')}
      >
        Navigate away
      </button>
    </>
  );
}
async function open(route: string, unrestricted = true, ids: string[] = []) {
  return renderWithApp(
    <NavigationGuardProvider>
      <PageBreadcrumbProvider>
        <LocationProbe />
        <Routes>{renderRouteTree(resolveDemoRoutes())}</Routes>
      </PageBreadcrumbProvider>
    </NavigationGuardProvider>,
    {
      route,
      namespace: 'pages-routes-navigation',
      namespaces: { 'pages-routes-navigation': enUS },
      fetch: answerApi(({ path }) =>
        path === 'authorization/permissions'
          ? {
              data: {
                unrestricted,
                permissions: ids.map((id) => ({
                  resource: { type: 'page', id },
                  actions: ['access'],
                })),
              },
            }
          : new Response(null, { status: 404 }),
      ),
      services: (app) =>
        app.container.singleton(
          authorizationClientToken,
          (resolver) =>
            new AuthorizationClient(resolver.resolve(apiClientToken)),
        ),
    },
  );
}
describe('routing example interactions', () => {
  it('opens nested task dialog and returns to drawer and filtered list', async () => {
    const user = userEvent.setup();
    await open('/projects?q=Harbor');
    await screen.findByRole('button', { name: 'New draft' });
    fireEvent.click(screen.getByRole('link', { name: 'Harbor launch' }), {
      button: 0,
    });
    fireEvent.click(
      await screen.findByRole('link', { name: 'Prepare launch checklist' }),
      { button: 0 },
    );
    expect(await screen.findByText(/Project p100, task t200/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back to project' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/projects/p100?q=Harbor',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Back to list' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/projects?q=Harbor',
      ),
    );
    expect(screen.getByLabelText('Search projects')).toHaveValue('Harbor');
  });
  it('shows a missing record without rendering another project', async () => {
    await open('/projects/missing');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'does not exist',
    );
  });
  it('redirects only the report parent and retains a directly opened tab', async () => {
    const view = await open('/reports?period=quarter');
    expect(await screen.findByText('2 sample projects')).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent(
      '/reports/summary?period=quarter',
    );
    view.unmount();
    await open('/reports/owners');
    expect(
      await screen.findByText('Avery Morgan: Harbor launch'),
    ).toBeVisible();
    expect(screen.getByTestId('location')).toHaveTextContent('/reports/owners');
  });
  it('requires the parent grant even for a child with skip', async () => {
    await open('/admin-notes/child', false);
    expect(await screen.findByText('Access denied')).toBeVisible();
    expect(screen.queryByText(/This child uses authz/)).not.toBeInTheDocument();
  });
  it('requires the extra draft grant as well as project access', async () => {
    await open('/projects/new', false, ['projects']);
    expect(await screen.findByText('Access denied')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'New draft' }),
    ).not.toBeInTheDocument();
  });
  it('previews a draft, blocks rejected close, then finishes without a server write', async () => {
    const user = userEvent.setup();
    await open('/projects/new?q=Harbor');
    await user.type(
      await screen.findByLabelText('Project name'),
      'New project',
    );
    await user.click(
      screen.getByRole('button', { name: 'Close', exact: true }),
    );
    expect(await screen.findByRole('alertdialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByLabelText('Project name')).toHaveValue('New project');
    await user.click(screen.getByRole('button', { name: 'Preview draft' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Draft preview: New project',
    );
    await user.click(screen.getByRole('button', { name: 'Finish preview' }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/projects?q=Harbor',
      ),
    );
  });

  it.each(['close first', 'navigation first'])(
    'settles overlapping leave requests and allows a later retry: %s',
    async (order) => {
      const user = userEvent.setup();
      await open('/projects/new?q=Harbor');
      await user.type(
        await screen.findByLabelText('Project name'),
        'New project',
      );
      const close = screen.getByRole('button', { name: 'Close', exact: true });
      const navigate = screen.getByTestId('navigate-away');

      // Dispatch navigation independently of the modal's pointer lock, as a
      // router or history request can arrive while confirmation is open.
      fireEvent.click(order === 'close first' ? close : navigate);
      expect(await screen.findByRole('alertdialog')).toBeVisible();
      await act(async () => {
        fireEvent.click(order === 'close first' ? navigate : close);
      });
      expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));

      expect(screen.getByTestId('location')).toHaveTextContent(
        '/projects/new?q=Harbor',
      );
      expect(screen.getByLabelText('Project name')).toHaveValue('New project');

      await user.click(close);
      expect(await screen.findByRole('alertdialog')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Keep editing' }));

      fireEvent.click(navigate);
      expect(await screen.findByRole('alertdialog')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Discard draft' }));
      await waitFor(() =>
        expect(screen.getByTestId('location')).toHaveTextContent(
          '/reports/owners',
        ),
      );
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    },
  );
});
