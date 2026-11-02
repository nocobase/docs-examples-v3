import {
  answerApi,
  renderWithApp,
  type ApiCall,
} from '@nocobase/app-testing/client';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ProductForm } from '../../client/pages/products/form.js';
import locales from '../../client/locales/index.js';
import metadata from '../../package.json' with { type: 'json' };

async function form(respond: () => Response | Promise<Response>) {
  const user = userEvent.setup();
  const onCreated = vi.fn();
  const requests = vi.fn((call: ApiCall) =>
    call.method === 'POST' && call.path === 'products'
      ? respond()
      : new Response(null, { status: 404 }),
  );
  await renderWithApp(<ProductForm onCreated={onCreated} />, {
    namespace: metadata.name,
    namespaces: { [metadata.name]: locales },
    locale: 'en-US',
    fetch: answerApi(requests),
  });
  await user.type(screen.getByLabelText('Product name'), 'Desk organizer');
  await user.type(screen.getByLabelText('Price in cents'), '2400');
  return { user, requests, onCreated };
}
const success = () =>
  Response.json(
    {
      data: {
        id: 'one',
        name: 'Desk organizer',
        priceCents: 2400,
        published: false,
      },
    },
    { status: 201 },
  );
it('sends the entered values and clears the form after success', async () => {
  const { user, requests, onCreated } = await form(success);
  await user.click(screen.getByRole('button', { name: 'Create draft' }));
  await screen.findByText('Draft created.');
  expect(requests.mock.calls).toEqual([
    [
      {
        method: 'POST',
        path: 'products',
        json: { name: 'Desk organizer', priceCents: 2400 },
      },
    ],
  ]);
  expect(screen.getByLabelText('Product name')).toHaveValue('');
  expect(onCreated).toHaveBeenCalledTimes(1);
});
it('keeps input on failure and allows a successful retry', async () => {
  const respond = vi
    .fn()
    .mockReturnValueOnce(new Response(null, { status: 500 }))
    .mockImplementation(success);
  const { user, onCreated } = await form(respond);
  await user.click(screen.getByRole('button', { name: 'Create draft' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Product name')).toHaveValue('Desk organizer');
  expect(onCreated).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Create draft' }));
  await screen.findByText('Draft created.');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(onCreated).toHaveBeenCalledTimes(1);
});
it('prevents another request while a submission is pending', async () => {
  const pending = Promise.withResolvers<Response>();
  const { user, requests } = await form(() => pending.promise);
  try {
    await user.click(screen.getByRole('button', { name: 'Create draft' }));
    await waitFor(() => expect(requests).toHaveBeenCalledTimes(1));
    const button = screen.getByRole('button', { name: 'Saving…' });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(requests).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Draft created.')).not.toBeInTheDocument();
  } finally {
    await act(async () => {
      pending.resolve(success());
    });
  }
  await screen.findByText('Draft created.');
});
