import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import { createUuid, useApiClient, useToaster } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { LoaderCircle } from 'lucide-react';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { Label } from '#components/ui/label';
import { Textarea } from '#components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select';
import { DeviceError } from '../devices/shared.js';
import { deviceCategories, type DeviceCategory } from '../devices/types.js';
import type { RequestsOutletContext } from './index.js';
import type { DeviceRequest } from './types.js';

export default function NewRequest() {
  const api = useApiClient();
  const toaster = useToaster();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { reload, search } = useOutletContext<RequestsOutletContext>();
  const [category, setCategory] = useState<DeviceCategory>('laptop');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  // One key per logical submission: a retry after an uncertain response is not a second request.
  const [key] = useState(() => createUuid());
  const closeTo = `/requests${search}`;
  const submit = async () => {
    const text = reason.trim();
    const problem = !text
      ? t('requests.errors.reasonRequired')
      : text.length > 500
        ? t('requests.errors.reasonLong')
        : '';
    setReasonError(problem);
    if (problem) {
      document.getElementById('request-reason')?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await api.request<{ data: DeviceRequest }>({
        path: 'requests',
        method: 'POST',
        json: { category, reason: text },
        headers: { 'Idempotency-Key': key },
      });
      toaster.show({
        type: 'success',
        title: t('requests.submitted', { requestNo: data.requestNo }),
      });
      reload();
      void navigate(`/requests/${data.id}${search}`, { replace: true });
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <RouteDialog
      title={t('requests.new')}
      description={t('requests.newHint')}
      closeTo={closeTo}
      footer={
        <>
          <Button
            variant='outline'
            disabled={busy}
            onClick={() => void navigate(closeTo, { replace: true })}
          >
            {t('requests.cancel')}
          </Button>
          <Button type='submit' form='request-form' disabled={busy}>
            {busy && <LoaderCircle className='animate-spin' />}
            {t(busy ? 'requests.submitting' : 'requests.submit')}
          </Button>
        </>
      }
    >
      <DeviceError error={error} />
      <form
        id='request-form'
        className='flex flex-col gap-4'
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className='flex flex-col gap-2'>
          <Label htmlFor='request-category'>
            {t('requests.category')} <span className='text-destructive'>*</span>
          </Label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as DeviceCategory)}
            disabled={busy}
          >
            <SelectTrigger id='request-category' className='w-full'>
              <SelectValue>{t(`devices.categories.${category}`)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {deviceCategories.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`devices.categories.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='request-reason'>
            {t('requests.reason')} <span className='text-destructive'>*</span>
          </Label>
          <Textarea
            id='request-reason'
            autoFocus
            className='min-h-24'
            placeholder={t('requests.reasonPlaceholder')}
            disabled={busy}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setReasonError('');
            }}
            aria-invalid={!!reasonError}
            aria-describedby={reasonError ? 'request-reason-error' : undefined}
          />
          {reasonError && (
            <p
              id='request-reason-error'
              role='alert'
              className='text-sm text-destructive'
            >
              {reasonError}
            </p>
          )}
        </div>
      </form>
    </RouteDialog>
  );
}
