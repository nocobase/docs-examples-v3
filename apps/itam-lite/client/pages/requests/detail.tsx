import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import {
  ApiClientError,
  PendingSubmissionError,
  useApiClient,
  useSubmission,
  useToaster,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useLocale, useTranslation } from '@nocobase/i18n/client';
import { LoaderCircle } from 'lucide-react';
import { FeedbackForm } from '#components/feedback-form';
import { RouteDrawer } from '#components/route-drawer';
import { LifecycleDiagram } from '#components/lifecycle-diagram';
import { Alert, AlertDescription } from '#components/ui/alert';
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
import { Separator } from '#components/ui/separator';
import { Skeleton } from '#components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#components/ui/dialog';
import { formatDate, formatDay } from './format.js';
import { RequestStateBadge } from './shared.js';
import type { RequestsOutletContext } from './index.js';
import type { LifecycleDescription, RequestDetail } from './types.js';

type Action = 'approve' | 'reject' | 'issue' | 'withdraw';
const order: Action[] = ['approve', 'reject', 'issue', 'withdraw'];

/** Server reasons worded for people; anything else falls back to the HTTP status. */
function errorKey(error: unknown) {
  if (error instanceof PendingSubmissionError) return 'requests.errors.pending';
  if (!(error instanceof ApiClientError)) return 'requests.errors.failed';
  if (error.reason === 'REQUEST_DEVICE_UNAVAILABLE')
    return 'requests.errors.deviceUnavailable';
  // A workflow refusal names the rule that blocked it in its blockers.
  const blocker = (
    error.payload as
      { error?: { metadata?: { blockers?: { code?: string }[] } } } | undefined
  )?.error?.metadata?.blockers?.[0]?.code;
  if (blocker === 'OWN_REQUEST') return 'requests.errors.ownRequest';
  if (blocker === 'REQUESTER_ONLY') return 'requests.errors.requesterOnly';
  if (error.status === 409) return 'requests.errors.conflict';
  if (error.status === 403) return 'requests.errors.denied';
  if (error.status === 404) return 'requests.errors.missing';
  return 'requests.errors.failed';
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className='grid grid-cols-[8rem_minmax(0,1fr)] gap-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='min-w-0 break-words'>{children}</span>
    </div>
  );
}

export default function RequestDetailPage() {
  const { requestId = '' } = useParams();
  const api = useApiClient();
  const toaster = useToaster();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const { reload: reloadList, search } =
    useOutletContext<RequestsOutletContext>();
  const [detail, setDetail] = useState<RequestDetail>();
  const [description, setDescription] = useState<LifecycleDescription>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState<Action>();
  const [comment, setComment] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [devices, setDevices] =
    useState<{ id: string; assetTag: string; name: string }[]>();
  const [fieldError, setFieldError] = useState('');
  const { session } = useAuthentication();
  // One controller per request version: every decision on this version shares its lock and, after an uncertain
  // response, its operation key, so a retry is answered with the first decision instead of being made twice. Once the
  // request moves on, its version and so the scope change, and the next decision starts a new operation.
  const submission = useSubmission({
    scope: `${session?.user.id}:deviceRequests:${requestId}:v${detail?.request.lifecycleVersion ?? ''}`,
  });
  // Cleared in the same render as a rejected attempt's field errors, so FeedbackForm still sees that attempt's invalid
  // fields and focuses the first one (the template's settings forms keep the same local flag).
  const [requestBusy, setRequestBusy] = useState(false);
  const busy = requestBusy || submission.submitting;
  const reload = useCallback(() => setRevision((n) => n + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api.request<{ data: RequestDetail }>({
        path: `requests/${requestId}`,
        signal: controller.signal,
      }),
      api.request<{ data: { description: LifecycleDescription } }>({
        path: 'requests/lifecycle',
        signal: controller.signal,
      }),
    ]).then(
      ([next, lifecycle]) => {
        if (controller.signal.aborted) return;
        setDetail(next.data);
        setDescription(lifecycle.data.description);
        setError(undefined);
      },
      (next: unknown) => {
        if (!controller.signal.aborted) setError(next);
      },
    );
    return () => controller.abort();
  }, [api, requestId, revision]);

  const open = (next: Action) => {
    setAction(next);
    setComment('');
    setDeviceId('');
    setFieldError('');
    if (next === 'issue') {
      setDevices(undefined);
      void api
        .request<{ data: { id: string; assetTag: string; name: string }[] }>({
          path: `requests/${requestId}/issuable`,
        })
        .then(({ data }) => setDevices(data), setError);
    }
  };
  const confirm = async () => {
    if (!action || !detail || busy) return;
    if (action === 'reject' && !comment.trim())
      return setFieldError(t('requests.errors.commentRequired'));
    if (action === 'issue' && !deviceId)
      return setFieldError(t('requests.errors.deviceRequired'));
    setRequestBusy(true);
    try {
      const done = await submission.run(
        {
          transition: action,
          input:
            action === 'issue'
              ? { deviceId }
              : action === 'withdraw'
                ? {}
                : { decisionComment: comment.trim() },
          expectVersion: detail.request.lifecycleVersion,
        },
        (key, signal, json) =>
          api.request({
            path: `requests/${requestId}/fire`,
            method: 'POST',
            json,
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      // Another entry already holds the lock.
      if (!done) return;
      toaster.show({
        type: 'success',
        title: t('requests.done', { requestNo: detail.request.requestNo }),
      });
      setAction(undefined);
      reload();
      reloadList();
    } catch (failure) {
      if (
        failure instanceof ApiClientError &&
        failure.reason === 'REQUEST_DEVICE_UNAVAILABLE'
      )
        setFieldError(t('requests.errors.deviceUnavailable'));
      else {
        setAction(undefined);
        toaster.show({ type: 'error', title: t(errorKey(failure)) });
        if (failure instanceof ApiClientError && failure.status === 409)
          reload();
      }
    } finally {
      setRequestBusy(false);
    }
  };

  const request = detail?.request;
  // Buttons come from the workflow's own judgement of what can happen next, narrowed to the actions the person's role
  // grants (rejecting is part of approving). The server refuses the rest anyway.
  const available = order.filter(
    (name) =>
      detail?.can[name === 'reject' ? 'approve' : name] &&
      detail.view.available.some((item) => item.name === name && item.allowed),
  );
  return (
    <RouteDrawer
      title={request ? request.requestNo : t('requests.title')}
      description={
        request ? <RequestStateBadge state={request.status} /> : undefined
      }
      closeTo={`/requests${search}`}
    >
      {error ? (
        <Alert variant='destructive'>
          <AlertDescription>{t(errorKey(error))}</AlertDescription>
        </Alert>
      ) : null}
      {!request || !detail ? (
        !error && (
          <div className='flex flex-col gap-3'>
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className='h-6 w-full' />
            ))}
          </div>
        )
      ) : (
        <div className='flex flex-col gap-5'>
          <div className='flex flex-col gap-2'>
            <Field label={t('requests.requester')}>
              {request.requesterName ?? request.requesterId}
            </Field>
            <Field label={t('requests.category')}>
              {t(`devices.categories.${request.category}`)}
            </Field>
            <Field label={t('requests.reason')}>{request.reason}</Field>
            <Field label={t('requests.neededBy')}>
              {formatDay(request.neededBy, locale)}
            </Field>
            <Field label={t('requests.needsApproval')}>
              {t(
                request.needsApproval
                  ? 'requests.needsApprovalYes'
                  : 'requests.needsApprovalNo',
              )}
            </Field>
            {request.decidedByName && (
              <Field label={t('requests.decidedBy')}>
                {request.decidedByName}
              </Field>
            )}
            {request.decisionComment && (
              <Field label={t('requests.decisionComment')}>
                {request.decisionComment}
              </Field>
            )}
            {request.deviceAssetTag && (
              <Field label={t('requests.device')}>
                {request.deviceAssetTag}
              </Field>
            )}
            <Field label={t('requests.createdAt')}>
              {formatDate(request.createdAt, locale)}
            </Field>
          </div>
          <div className='flex flex-col gap-2'>
            <h3 className='text-sm font-medium'>{t('requests.actions')}</h3>
            {available.length ? (
              <div className='flex flex-wrap gap-2'>
                {available.map((name) => (
                  <Button
                    key={name}
                    variant={
                      name === 'reject' || name === 'withdraw'
                        ? 'outline'
                        : 'default'
                    }
                    onClick={() => open(name)}
                  >
                    {t(`requests.transitions.${name}`)}
                  </Button>
                ))}
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>
                {t('requests.noActions')}
              </p>
            )}
          </div>
          <Separator />
          <div className='flex flex-col gap-2'>
            <h3 className='text-sm font-medium'>{t('requests.progress')}</h3>
            {description && (
              <LifecycleDiagram
                description={description}
                ariaLabel={t('requests.progress')}
                presentation='process'
                currentState={detail.view.state}
                history={detail.view.history.transitions}
                stateLabel={(state) => t(`requests.states.${state.name}`)}
                transitionLabel={(transition) =>
                  t(`requests.transitions.${transition.name}`)
                }
              />
            )}
          </div>
          <div className='flex flex-col gap-2'>
            <h3 className='text-sm font-medium'>{t('requests.history')}</h3>
            <ol className='flex flex-col gap-2 text-sm'>
              {detail.view.history.transitions.map((entry) => (
                <li
                  key={entry.id}
                  className='flex flex-wrap justify-between gap-2'
                >
                  <span>
                    {t(`requests.transitions.${entry.transition}`)} ·{' '}
                    {detail.actors[entry.actorId] ?? entry.actorId}
                  </span>
                  <span className='text-muted-foreground'>
                    {formatDate(entry.at, locale)}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
      <Dialog
        open={!!action}
        onOpenChange={(next) => !next && !busy && setAction(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action ? t(`requests.transitions.${action}`) : ''}
            </DialogTitle>
            <DialogDescription>{request?.requestNo}</DialogDescription>
          </DialogHeader>
          {/* The confirm button submits this form, so Enter and a second click share one submission. */}
          <FeedbackForm
            id='request-action-form'
            className='flex flex-col gap-4 empty:hidden'
            noValidate
            submitting={busy}
            onSubmit={(event) => {
              event.preventDefault();
              void confirm();
            }}
          >
            {(action === 'approve' || action === 'reject') && (
              <div className='flex flex-col gap-2'>
                <Label htmlFor='request-comment'>
                  {t(
                    action === 'reject'
                      ? 'requests.commentRequired'
                      : 'requests.commentOptional',
                  )}
                </Label>
                <Textarea
                  id='request-comment'
                  name='decisionComment'
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                    setFieldError('');
                  }}
                  aria-invalid={!!fieldError}
                  aria-describedby={
                    fieldError ? 'request-action-error' : undefined
                  }
                />
              </div>
            )}
            {action === 'issue' && (
              <div className='flex flex-col gap-2'>
                <Label htmlFor='request-device'>
                  {t('requests.chooseDevice')}
                </Label>
                {devices && !devices.length ? (
                  <p className='text-sm text-muted-foreground'>
                    {t('requests.noIssuableDevices')}
                  </p>
                ) : (
                  <Select
                    value={deviceId}
                    onValueChange={(value) => {
                      setDeviceId(String(value));
                      setFieldError('');
                    }}
                  >
                    <SelectTrigger
                      id='request-device'
                      data-field-path='deviceId'
                      className='w-full'
                      aria-invalid={!!fieldError}
                      aria-describedby={
                        fieldError ? 'request-action-error' : undefined
                      }
                    >
                      <SelectValue>
                        {devices?.find((device) => device.id === deviceId)
                          ? `${devices.find((device) => device.id === deviceId)!.assetTag} · ${devices.find((device) => device.id === deviceId)!.name}`
                          : t('requests.chooseDevicePlaceholder')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(devices ?? []).map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.assetTag} · {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            {fieldError && (
              <p
                id='request-action-error'
                data-feedback-field-error
                className='text-sm text-destructive'
              >
                {fieldError}
              </p>
            )}
          </FeedbackForm>
          <DialogFooter>
            <Button
              variant='outline'
              disabled={busy}
              onClick={() => setAction(undefined)}
            >
              {t('requests.cancel')}
            </Button>
            <Button type='submit' form='request-action-form' disabled={busy}>
              {busy && <LoaderCircle className='animate-spin' />}
              {t('requests.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </RouteDrawer>
  );
}
