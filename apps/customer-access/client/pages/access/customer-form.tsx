import { Feedback } from './shared.js';
import { useState } from 'react';
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from 'react-router';
import { useApiClient, useSubmission, useToaster } from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Field, FieldGroup, FieldLabel } from '#components/ui/field';
import { FeedbackForm } from '#components/feedback-form';
import { useListData } from '#hooks/use-list-data';
import { useSettingsLeave } from '../settings/hooks.js';
import { useAccess, errorKey, isUnavailable, type Customer } from './api.js';
export default function CustomerForm() {
  const { id } = useParams();
  return <CustomerEditor key={id ?? 'new'} id={id} />;
}
function CustomerEditor({ id }: { id?: string }) {
  const { t } = useTranslation();
  const permission = useAccess(id ? 'editCustomer' : 'createCustomer');
  const request = useListData<{ data: Customer }>(`/customers/${id}/editData`, {
    active: Boolean(id) && permission.can,
  });
  const record = id ? request.data?.data : undefined;
  const [error, setError] = useState<unknown>();
  const terminal = isUnavailable(error);
  const ready =
    !terminal &&
    !permission.isPending &&
    permission.can &&
    (!id || (!request.loading && !request.error && Boolean(record)));
  const api = useApiClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { reload } = useOutletContext<{ reload: () => void }>();
  const { session } = useAuthentication();
  const initial = {
    name: record?.name ?? '',
    email: record?.email ?? '',
    notes: record?.notes ?? '',
  };
  const [draft, setDraft] = useState<typeof initial>();
  const values = draft ?? initial;
  const submission = useSubmission({
    scope: `${session?.user.id}:customer:${id ?? 'new'}`,
  });
  const leave = useSettingsLeave(
    JSON.stringify(initial) !== JSON.stringify(values),
    submission.submitting || submission.pending,
  );
  const toaster = useToaster();
  const save = async () => {
    if (!ready) return;
    setError(undefined);
    try {
      const result = await submission.run(values, (key, signal, snapshot) =>
        api.request({
          path: record ? `/customers/${record.id}` : '/customers',
          method: record ? 'PATCH' : 'POST',
          json: snapshot,
          headers: { 'Idempotency-Key': key },
          signal,
        }),
      );
      if (!result) return;
      leave.allow();
      reload();
      toaster.show({ type: 'success', title: t('access.saved') });
      await navigate({ pathname: '/customers', search: location.search });
    } catch (error) {
      setError(error);
      if (isUnavailable(error)) {
        leave.allow();
        reload();
      }
    }
  };
  return (
    <>
      <RouteDialog
        className='sm:max-w-md'
        title={t(id ? 'access.editCustomer' : 'access.createCustomer')}
        description={t('access.editHint')}
        beforeClose={leave.guard}
        closeTo={{ pathname: '/customers', search: location.search }}
        footer={
          ready ? (
            <>
              <Button
                variant='outline'
                disabled={submission.submitting}
                onClick={() => {
                  void (async () => {
                    if (await leave.guard())
                      await navigate({
                        pathname: '/customers',
                        search: location.search,
                      });
                  })();
                }}
              >
                {t('access.cancel')}
              </Button>
              <Button
                type='submit'
                form='customer-form'
                disabled={submission.submitting}
              >
                {t(submission.submitting ? 'access.saving' : 'access.save')}
              </Button>
            </>
          ) : terminal || isUnavailable(request.error) ? (
            <Button
              variant='outline'
              onClick={() => {
                leave.allow();
                reload();
                void navigate({
                  pathname: '/customers',
                  search: location.search,
                });
              }}
            >
              {t('access.backToList')}
            </Button>
          ) : undefined
        }
      >
        {!ready ? (
          <>
            <Feedback
              loading={
                permission.isPending || (permission.can && request.loading)
              }
              error={terminal ? error : request.error}
              retry={request.reload}
            />
            {!permission.isPending && !permission.can ? (
              <p role='alert'>{t('access.denied')}</p>
            ) : null}
          </>
        ) : (
          <FeedbackForm
            error={error}
            errorContent={error ? t(errorKey(error)) : undefined}
            submitting={submission.submitting}
            id='customer-form'
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <FieldGroup>
              {(['name', 'email', 'notes'] as const).map((field) => (
                <Field key={field}>
                  <FieldLabel htmlFor={field}>
                    {t(`access.${field}`)}
                    {field !== 'notes' ? (
                      <span aria-hidden='true'> *</span>
                    ) : null}
                  </FieldLabel>
                  <Input
                    id={field}
                    name={field}
                    type={field === 'email' ? 'email' : 'text'}
                    required={field !== 'notes'}
                    maxLength={
                      field === 'notes' ? 1000 : field === 'email' ? 200 : 100
                    }
                    value={values[field]}
                    disabled={submission.submitting}
                    onChange={(event) =>
                      setDraft({ ...values, [field]: event.target.value })
                    }
                  />
                </Field>
              ))}
            </FieldGroup>
          </FeedbackForm>
        )}
      </RouteDialog>
      {leave.dialog}
    </>
  );
}
