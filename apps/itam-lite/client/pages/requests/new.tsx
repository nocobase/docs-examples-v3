import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router';
import {
  ApiClientError,
  PendingSubmissionError,
  useApiClient,
  useSubmission,
  useToaster,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { LoaderCircle } from 'lucide-react';
import { FeedbackForm } from '#components/feedback-form';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
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
  const [neededBy, setNeededBy] = useState('');
  const [neededByError, setNeededByError] = useState('');
  const { session } = useAuthentication();
  // One controller for this form: Enter and the footer button share its lock, and a retry after an uncertain
  // response reuses the operation key, so the server answers the first submission instead of filing a second request.
  const submission = useSubmission({
    scope: `${session?.user.id}:deviceRequests:new`,
  });
  // Cleared in the same render as a rejected attempt's field errors, so FeedbackForm still sees that attempt's invalid
  // fields and focuses the first one (the template's settings forms keep the same local flag).
  const [requestBusy, setRequestBusy] = useState(false);
  const busy = requestBusy || submission.submitting;
  const [error, setError] = useState<unknown>();
  const closeTo = `/requests${search}`;
  const submit = async () => {
    if (busy) return;
    const text = reason.trim();
    const problem = !text
      ? t('requests.errors.reasonRequired')
      : text.length > 500
        ? t('requests.errors.reasonLong')
        : '';
    setReasonError(problem);
    // FeedbackForm moves focus to the first invalid field in layout order.
    if (problem) return;
    setError(undefined);
    setRequestBusy(true);
    try {
      const submitted = await submission.run(
        { category, reason: text, neededBy: neededBy || null },
        (key, signal, json) =>
          api.request<{ data: DeviceRequest }>({
            path: 'requests',
            method: 'POST',
            json,
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      // Another entry already holds the lock.
      if (!submitted) return;
      const { data } = submitted;
      toaster.show({
        type: 'success',
        title: t('requests.submitted', { requestNo: data.requestNo }),
      });
      reload();
      void navigate(`/requests/${data.id}${search}`, { replace: true });
    } catch (failure) {
      if (
        failure instanceof ApiClientError &&
        failure.reason === 'REQUEST_NEEDED_BY_PAST'
      ) {
        setNeededByError(t('requests.errors.neededByPast'));
        return;
      }
      setError(failure);
    } finally {
      setRequestBusy(false);
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
      <FeedbackForm
        id='request-form'
        className='flex flex-col gap-4'
        noValidate
        submitting={busy}
        error={error}
        errorContent={
          error instanceof PendingSubmissionError ? (
            t('requests.errors.pending')
          ) : (
            <DeviceError error={error} inline />
          )
        }
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
            name='reason'
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
              data-feedback-field-error
              className='text-sm text-destructive'
            >
              {reasonError}
            </p>
          )}
        </div>
        <div className='flex flex-col gap-2'>
          <Label htmlFor='request-neededBy'>{t('requests.neededBy')}</Label>
          <Input
            id='request-neededBy'
            name='neededBy'
            type='date'
            className='w-48'
            disabled={busy}
            value={neededBy}
            onChange={(event) => {
              setNeededBy(event.target.value);
              setNeededByError('');
            }}
            aria-invalid={!!neededByError}
            aria-describedby={
              neededByError ? 'request-neededBy-error' : undefined
            }
          />
          {neededByError && (
            <p
              id='request-neededBy-error'
              data-feedback-field-error
              className='text-sm text-destructive'
            >
              {neededByError}
            </p>
          )}
        </div>
      </FeedbackForm>
    </RouteDialog>
  );
}
