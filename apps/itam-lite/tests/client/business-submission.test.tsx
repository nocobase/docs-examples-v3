// The device and request forms against the real application: repeated entry points and a retry after a lost response
// write one row, because both share the form's useSubmission operation and the server keeps a receipt for its key.
import { databaseManagerToken } from '@nocobase/db';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DeviceForm from '../../client/pages/devices/form.js';
import NewRequest from '../../client/pages/requests/new.js';
import { renderAuthenticatedClient } from '../helpers/authenticated-client.js';
import enUS from '../../client/locales/en-US.js';

const reload = vi.fn();
const routes = (
  <Routes>
    <Route
      path='/devices'
      element={<Outlet context={{ reload, search: '' }} />}
    >
      <Route path='new' element={<DeviceForm />} />
    </Route>
    <Route
      path='/requests'
      element={<Outlet context={{ reload, search: '' }} />}
    >
      <Route path='new' element={<NewRequest />} />
      <Route path=':requestId' element={<p>Request detail</p>} />
    </Route>
  </Routes>
);

/** Records each write's operation key, holds the first one until released, and can lose one committed response. */
function writes(path: string) {
  const keys: string[] = [];
  const held = Promise.withResolvers<void>();
  let hold = false;
  let loseNext = false;
  const matches = (request: Request) =>
    request.method === 'POST' && new URL(request.url).pathname.endsWith(path);
  return {
    keys,
    hold: () => (hold = true),
    release: () => held.resolve(),
    loseNextResponse: () => (loseNext = true),
    async beforeRequest(request: Request) {
      if (!matches(request)) return;
      keys.push(request.headers.get('Idempotency-Key') ?? '');
      if (hold) {
        hold = false;
        await held.promise;
      }
    },
    afterResponse(request: Request) {
      if (!matches(request) || !loseNext) return;
      loseNext = false;
      // The server has committed; the browser never sees the answer.
      throw new TypeError('Failed to fetch');
    },
  };
}

beforeEach(() => {
  reload.mockClear();
  sessionStorage.clear();
});

describe('business form submissions', () => {
  it('registers one device for a double click and Enter while the save is in flight', async () => {
    const traffic = writes('/devices');
    const view = await renderAuthenticatedClient(routes, {
      route: '/devices/new',
      beforeRequest: traffic.beforeRequest,
      afterResponse: traffic.afterResponse,
    });
    await userEvent.type(
      await screen.findByLabelText(new RegExp(enUS.devices.assetTag)),
      'IT-C-0001',
    );
    await userEvent.type(
      screen.getByLabelText(new RegExp(`^${enUS.devices.name}`)),
      'Test laptop',
    );
    traffic.hold();
    const save = screen.getByRole('button', { name: enUS.devices.create });
    await userEvent.click(save);
    fireEvent.click(save);
    fireEvent.submit(document.getElementById('device-form')!);
    await waitFor(() => expect(traffic.keys).toHaveLength(1));
    traffic.release();
    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    const devices = view.server.application.container
      .resolve(databaseManagerToken)
      .repository('devices');
    expect(await devices.count({})).toBe(1);
    expect(traffic.keys).toHaveLength(1);
  });

  it('retries a request whose answer was lost with the same key and files it once', async () => {
    const traffic = writes('/requests');
    const view = await renderAuthenticatedClient(routes, {
      route: '/requests/new',
      beforeRequest: traffic.beforeRequest,
      afterResponse: traffic.afterResponse,
    });
    await userEvent.type(
      await screen.findByLabelText(new RegExp(enUS.requests.reason)),
      'New starter',
    );
    traffic.loseNextResponse();
    const submit = screen.getByRole('button', { name: enUS.requests.submit });
    await userEvent.click(submit);
    // The first attempt committed, but the page only saw a failure: the input is kept for a retry.
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByLabelText(new RegExp(enUS.requests.reason))).toHaveValue(
      'New starter',
    );
    await userEvent.click(submit);
    expect(await screen.findByText('Request detail')).toBeInTheDocument();
    expect(traffic.keys).toHaveLength(2);
    expect(traffic.keys[1]).toBe(traffic.keys[0]);
    const requests = view.server.application.container
      .resolve(databaseManagerToken)
      .repository('deviceRequests');
    expect(await requests.count({})).toBe(1);
  });
});
