import { useEffect, useRef, useState } from 'react';
import { useApiClient, useToaster } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useChatPanel } from '@nocobase/app-plugin-agents/client/chat';
import type { ModelService } from '@nocobase/app-plugin-agents/shared/models';
import { useTranslation } from '@nocobase/i18n/client';
import { FileText } from 'lucide-react';
import { Button } from '#components/ui/button';
import { Spinner } from '#components/ui/spinner';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '#components/ui/tooltip';

/** The documentation entry selects the server-owned scope; the server still authorizes requests. */
export function ReleaseNotesButton() {
  const api = useApiClient();
  const panel = useChatPanel();
  const toaster = useToaster();
  const { t } = useTranslation();
  const permission = useCan({
    resource: { type: 'settings', id: 'agents.agents' },
    action: 'read',
  });
  const busyRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const [pending, setPending] = useState(false);
  async function openReleaseNotes() {
    if (busyRef.current) return;
    busyRef.current = true;
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    try {
      const { data: services } = await api.request<{ data: ModelService[] }>({
        path: 'agents/models',
        signal: controller.signal,
      });
      const service = services.find((s) =>
        s.models.some((m) => m.kind === 'chat'),
      );
      if (controller.signal.aborted) return;
      const model = service?.models.find((m) => m.kind === 'chat');
      if (!service || !model) throw new Error('No configured chat model');
      const { data } = await api.request<{ data: { id: string } }>({
        path: 'agents/conversations',
        signal: controller.signal,
        method: 'POST',
        json: {
          agentId: 'online',
          title: t('agentDemo.releaseNotes'),
          config: { scope: ['release-notes'] },
          selectedModel: { modelService: service.name, model: model.value },
        },
      });
      if (controller.signal.aborted) return;
      panel.openChat({ conversationId: data.id });
      panel.focusComposer();
    } catch {
      if (controller.signal.aborted) return;
      toaster.show({ type: 'error', title: t('agentDemo.releaseNotesError') });
    } finally {
      busyRef.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  if (!panel.available || !permission.can) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant='ghost'
            size='icon'
            aria-label={t('agentDemo.releaseNotes')}
            aria-busy={pending}
            disabled={pending}
            onClick={() => void openReleaseNotes()}
          >
            {pending ? <Spinner aria-hidden='true' /> : <FileText />}
          </Button>
        }
      />
      <TooltipContent>{t('agentDemo.releaseNotes')}</TooltipContent>
    </Tooltip>
  );
}
