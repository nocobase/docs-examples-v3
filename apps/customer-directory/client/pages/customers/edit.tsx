import { useCan } from '@nocobase/app-plugin-authorization/client';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '#components/ui/collapsible';
import { useState } from 'react';
import { useParams } from 'react-router';
import {
  ApiClientError,
  useApiClient,
  useSubmission,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { FeedbackForm } from '#components/feedback-form';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { Alert, AlertDescription } from '#components/ui/alert';
import { useListData } from '#hooks/use-list-data';
import { Choice } from './choice.js';
import { useCustomerContext } from './context.js';
import { useEditorLeave } from './use-editor-leave.js';
import {
  armWriteDemo,
  errorKey,
  saveCustomer,
  type Customer,
  type CustomerValues,
  type WriteMode,
} from './api.js';
const empty: CustomerValues = {
  name: '',
  contact: '',
  email: '',
  status: 'active',
};
export default function CustomerEditorPage() {
  const { id } = useParams();
  return <CustomerEditor key={id ?? 'new'} id={id} />;
}
function CustomerEditor({ id }: { id?: string }) {
  const { t } = useTranslation();
  const api = useApiClient();
  const permission = useCan({
    resource: { type: 'composite', id: 'customers' },
    action: id ? 'edit' : 'create',
  });
  const { session } = useAuthentication();
  const parent = useCustomerContext();
  const request = useListData<{ data: Customer }>(
    `customerRecord/${encodeURIComponent(id ?? '')}`,
    { active: Boolean(id) },
  );
  const [initialized, setInitialized] = useState(!id);
  const [values, setValues] = useState<CustomerValues>(empty);
  if (!initialized && request.data) {
    const { name, contact, email, status } = request.data.data;
    setValues({ name, contact, email, status });
    setInitialized(true);
  }
  const [dirty, setDirty] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [mode, setMode] = useState<WriteMode>('normal');
  const [error, setError] = useState<unknown>();
  const submission = useSubmission({
    scope: `${session?.user.id}:customers:${id ?? 'new'}`,
  });
  const leave = useEditorLeave(
    dirty,
    submission.pending || submission.submitting,
  );
  function change(next: CustomerValues) {
    setValues(next);
    setDirty(true);
    leave.setDirty(true);
    if (!submission.pending) setError(undefined);
  }
  async function save(close: () => Promise<void>) {
    if (submission.submitting) return;
    leave.setPending(true);
    setError(undefined);
    setAttempted(true);
    let saved: Customer | undefined;
    try {
      saved = await submission.run(
        { id, ...values },
        async (key, signal, input, recovering) => {
          if (!recovering) await armWriteDemo(api, key, mode, signal);
          const { id: recordId, ...fields } = input;
          return saveCustomer(api, fields, recordId, key, signal);
        },
      );
    } catch (e) {
      setError(e);
      const known =
        e instanceof ApiClientError &&
        e.status >= 400 &&
        e.status < 500 &&
        ![
          'OPERATION_CONFLICT',
          'OPERATION_EXPIRED',
          'REQUEST_TIMEOUT',
        ].includes(e.reason ?? '');
      leave.setPending(submission.pending || !known);
      return;
    }
    if (!saved) {
      leave.setPending(false);
      return;
    }
    leave.allow();
    setDirty(false);
    parent.reload();
    await close();
  }
  const accessLost =
    error instanceof ApiClientError && [401, 403, 404].includes(error.status);
  const unavailable =
    !permission.can ||
    accessLost ||
    Boolean(id && (request.error || !initialized));
  return (
    <RouteDialog
      title={t(id ? 'customers.edit' : 'customers.new')}
      beforeClose={leave.guard}
      footer={
        <EditorFooter
          busy={submission.submitting}
          pending={submission.pending}
          disabled={unavailable}
          canSave={permission.can}
        />
      }
    >
      {unavailable ? (
        <p role={accessLost || request.error ? 'alert' : 'status'}>
          {t(
            !permission.can
              ? permission.isPending
                ? 'customers.loading'
                : 'customers.forbidden'
              : accessLost
                ? errorKey(error)
                : request.error
                  ? errorKey(request.error)
                  : 'customers.loading',
          )}
        </p>
      ) : (
        <>
          {submission.pending && !submission.submitting ? (
            <Alert>
              <AlertDescription>
                {t(
                  attempted
                    ? 'customers.uncertain'
                    : 'customers.recoverAfterReload',
                )}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant='destructive' className='mt-3'>
              <AlertDescription>
                {t(
                  submission.pending
                    ? 'customers.unknownResult'
                    : errorKey(error),
                )}
              </AlertDescription>
            </Alert>
          ) : null}
          <CustomerForm
            values={values}
            onChange={change}
            locked={submission.submitting || (submission.pending && attempted)}
            busy={submission.submitting}
            onSave={save}
          />
          <Collapsible className='mt-5 rounded-lg border p-3'>
            <CollapsibleTrigger className='cursor-pointer text-sm font-medium'>
              {t('customers.writeDemo')}
            </CollapsibleTrigger>
            <CollapsibleContent className='mt-3'>
              <Choice
                label={t('customers.writeMode')}
                value={mode}
                disabled={submission.submitting || submission.pending}
                options={['normal', 'slow', 'reject', 'lose'].map((value) => ({
                  value,
                  label: t(`customers.writeModes.${value}`),
                }))}
                onChange={(v) => setMode(v as WriteMode)}
              />
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
      {leave.confirmation}
    </RouteDialog>
  );
}
function CustomerForm({
  values,
  onChange,
  locked,
  busy,
  onSave,
}: {
  values: CustomerValues;
  onChange: (v: CustomerValues) => void;
  locked: boolean;
  busy: boolean;
  onSave: (close: () => Promise<void>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <FeedbackForm
      id='customer-form'
      className='mt-4 grid gap-4'
      submitting={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        await onSave(close);
      }}
    >
      {(['name', 'contact', 'email'] as const).map((field) => (
        <div className='grid gap-2' key={field}>
          <Label htmlFor={`customer-${field}`}>{t(`customers.${field}`)}</Label>
          <Input
            id={`customer-${field}`}
            name={field}
            value={values[field]}
            required
            type={field === 'email' ? 'email' : 'text'}
            maxLength={field === 'email' ? 200 : 100}
            readOnly={locked}
            onChange={(e) => onChange({ ...values, [field]: e.target.value })}
          />
        </div>
      ))}
      <Choice
        label={t('customers.status')}
        value={values.status}
        disabled={locked}
        options={['active', 'inactive'].map((value) => ({
          value,
          label: t(`customers.${value}`),
        }))}
        onChange={(v) =>
          onChange({ ...values, status: v as CustomerValues['status'] })
        }
      />
    </FeedbackForm>
  );
}
function EditorFooter({
  busy,
  pending,
  disabled,
  canSave,
}: {
  busy: boolean;
  pending: boolean;
  disabled: boolean;
  canSave: boolean;
}) {
  const { t } = useTranslation();
  const { close, isClosing } = useRouteOverlay();
  return (
    <>
      <Button
        variant='outline'
        disabled={busy || pending || isClosing}
        onClick={() => void close()}
      >
        {t('customers.cancel')}
      </Button>
      {canSave ? (
        <Button
          type='submit'
          form='customer-form'
          disabled={busy || disabled || isClosing}
        >
          {t(
            busy
              ? 'customers.saving'
              : pending
                ? 'customers.retryOriginal'
                : 'customers.save',
          )}
        </Button>
      ) : null}
    </>
  );
}
