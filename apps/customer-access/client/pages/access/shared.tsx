import { ApiClientError } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { Button } from '#components/ui/button';
import { errorKey } from './api.js';
export function Feedback({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  const { t } = useTranslation();
  if (loading) return <p role='status'>{t('access.loading')}</p>;
  if (!error) return null;
  const retryable = !(error instanceof ApiClientError) || error.status >= 500;
  return (
    <div role='alert' className='space-y-3'>
      <p>{t(errorKey(error))}</p>
      {retry && retryable ? (
        <Button variant='outline' onClick={retry}>
          {t('access.retry')}
        </Button>
      ) : null}
    </div>
  );
}
