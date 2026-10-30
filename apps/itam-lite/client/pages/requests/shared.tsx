import { useTranslation } from '@nocobase/i18n/client';
import { StatusBadge } from '#components/status-badge';
import type { RequestState } from './types.js';

const tones = {
  draft: 'neutral',
  pendingApproval: 'warning',
  readyToIssue: 'info',
  issued: 'success',
  rejected: 'neutral',
  withdrawn: 'neutral',
} as const;

export function RequestStateBadge({ state }: { state: RequestState }) {
  const { t } = useTranslation();
  return (
    <StatusBadge tone={tones[state]}>
      {t(`requests.states.${state}`)}
    </StatusBadge>
  );
}
