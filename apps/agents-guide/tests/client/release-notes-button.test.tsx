import { apiClientToken } from '@nocobase/app-client';
import {
  AuthorizationClient,
  authorizationClientToken,
} from '@nocobase/app-plugin-authorization/client';
import {
  ChatProvider,
  useChatPanel,
  CHAT_PANEL_STORAGE_KEY,
} from '@nocobase/app-plugin-agents/client/chat';
import {
  answerApi,
  renderWithApp,
  type ApiCall,
} from '@nocobase/app-testing/client';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReleaseNotesButton } from '../../client/components/release-notes-button.js';
import enUS from '../../client/locales/en-US.js';
import metadata from '../../package.json' with { type: 'json' };

let allowed = true;
let models: unknown;
let creation: unknown;
const api = vi.fn(({ path }: ApiCall) => {
  if (path === 'authorization/permissions')
    return { data: { unrestricted: allowed, permissions: [] } };
  if (path === 'agents/models') return models;
  if (path === 'agents/conversations') return creation;
  return new Response(null, { status: 404 });
});
function PanelProbe() {
  const panel = useChatPanel();
  return (
    <output aria-label='Opened conversation'>
      {panel.open ? panel.conversationId : 'closed'}
    </output>
  );
}
async function renderButton() {
  return renderWithApp(
    <ChatProvider memoryScope='test-user'>
      <ReleaseNotesButton />
      <PanelProbe />
    </ChatProvider>,
    {
      namespace: metadata.name,
      namespaces: { [metadata.name]: enUS },
      fetch: answerApi(api),
      services: (app) => {
        app.container.singleton(
          authorizationClientToken,
          (resolver) =>
            new AuthorizationClient(resolver.resolve(apiClientToken)),
        );
      },
    },
  );
}
beforeEach(() => {
  sessionStorage.removeItem(CHAT_PANEL_STORAGE_KEY);
  api.mockClear();
  allowed = true;
  models = {
    data: [
      {
        name: 'demo',
        models: [
          { kind: 'embedding', value: 'embed' },
          { kind: 'chat', value: 'chat-model' },
        ],
      },
    ],
  };
  creation = { data: { id: 'release-conversation' } };
});
describe('release notes entry', () => {
  it('opens a scoped native conversation with a configured chat model', async () => {
    await renderButton();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Draft release notes' }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Opened conversation')).toHaveTextContent(
        'release-conversation',
      ),
    );
    expect(api).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'POST',
        path: 'agents/conversations',
        json: {
          agentId: 'online',
          title: 'Draft release notes',
          config: { scope: ['release-notes'] },
          selectedModel: { modelService: 'demo', model: 'chat-model' },
        },
      }),
    );
  });
  it('disables duplicate submission while the model catalog is loading', async () => {
    const deferred = Promise.withResolvers<unknown>();
    models = deferred.promise;
    await renderButton();
    const button = await screen.findByRole('button', {
      name: 'Draft release notes',
    });
    await userEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull();
    await userEvent.click(button);
    await act(async () =>
      deferred.resolve({
        data: [
          { name: 'demo', models: [{ kind: 'chat', value: 'chat-model' }] },
        ],
      }),
    );
    await waitFor(() => expect(button).toBeEnabled());
    expect(
      api.mock.calls.filter(([call]) => call.path === 'agents/conversations'),
    ).toHaveLength(1);
  });
  it('shows failure without opening a conversation when no chat model exists', async () => {
    models = { data: [] };
    const view = await renderButton();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Draft release notes' }),
    );
    await waitFor(() =>
      expect(view.toasts()).toMatchObject([
        { type: 'error', title: enUS.agentDemo.releaseNotesError },
      ]),
    );
    expect(screen.getByLabelText('Opened conversation')).toHaveTextContent(
      'closed',
    );
    expect(
      api.mock.calls.filter(([call]) => call.path === 'agents/conversations'),
    ).toHaveLength(0);
  });
  it('shows a failed creation and allows retry', async () => {
    creation = new Response(
      JSON.stringify({ error: { message: 'Unavailable' } }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
    const view = await renderButton();
    const button = await screen.findByRole('button', {
      name: 'Draft release notes',
    });
    await userEvent.click(button);
    await waitFor(() =>
      expect(view.toasts()).toMatchObject([{ type: 'error' }]),
    );
    expect(button).toBeEnabled();
    creation = { data: { id: 'retry-conversation' } };
    await userEvent.click(button);
    await waitFor(() =>
      expect(screen.getByLabelText('Opened conversation')).toHaveTextContent(
        'retry-conversation',
      ),
    );
  });
  it('hides the entry from a user without agent catalog permission', async () => {
    allowed = false;
    const view = await renderButton();
    await view.app.container.resolve(authorizationClientToken).snapshot();
    expect(
      screen.queryByRole('button', { name: 'Draft release notes' }),
    ).not.toBeInTheDocument();
    expect(
      api.mock.calls.filter(([call]) => call.path === 'agents/models'),
    ).toHaveLength(0);
  });
  it('does not create a conversation after its identity lifetime ends', async () => {
    const deferred = Promise.withResolvers<unknown>();
    models = deferred.promise;
    const view = await renderButton();
    await userEvent.click(
      await screen.findByRole('button', { name: 'Draft release notes' }),
    );
    view.unmount();
    await act(async () =>
      deferred.resolve({
        data: [
          { name: 'demo', models: [{ kind: 'chat', value: 'chat-model' }] },
        ],
      }),
    );
    expect(
      api.mock.calls.filter(([call]) => call.path === 'agents/conversations'),
    ).toHaveLength(0);
  });
});
