import { ApiClientError } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { CircleCheck, CircleDot, Wrench, Archive } from 'lucide-react';
import { StatusBadge } from '#components/status-badge';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';
import type { DeviceStatus } from './types.js';

const tones = {
  inStock: 'success',
  inUse: 'info',
  inRepair: 'warning',
  retired: 'neutral',
} as const;
const icons = {
  inStock: CircleCheck,
  inUse: CircleDot,
  inRepair: Wrench,
  retired: Archive,
};

export function DeviceStatusBadge({ status }: { status: DeviceStatus }) {
  const { t } = useTranslation();
  const Icon = icons[status];
  return (
    <StatusBadge tone={tones[status]}>
      <Icon />
      {t(`devices.statuses.${status}`)}
    </StatusBadge>
  );
}

/** One alert for any request failure, worded by its HTTP status. */
export function DeviceError({
  error,
  retry,
  reading = false,
}: {
  error: unknown;
  retry?: () => void;
  reading?: boolean;
}) {
  const { t } = useTranslation();
  if (!error) return null;
  const status = error instanceof ApiClientError ? error.status : 0;
  const key =
    status === 403
      ? 'devices.errors.denied'
      : status === 404
        ? 'devices.errors.missing'
        : status === 400
          ? 'devices.errors.invalid'
          : reading
            ? 'devices.errors.loadFailed'
            : 'devices.errors.failed';
  return (
    <Alert variant='destructive'>
      <AlertDescription>
        {t(key)}
        {retry && ![403, 404].includes(status) && (
          <Button variant='outline' size='sm' onClick={retry}>
            {t('devices.errors.retry')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
