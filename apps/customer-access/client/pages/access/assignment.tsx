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
import { Label } from '#components/ui/label';
import {
  Combobox,
  ComboboxTrigger,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from '#components/ui/combobox';
import { useListData } from '#hooks/use-list-data';
import { useSettingsLeave } from '../settings/hooks.js';
import {
  useAccess,
  errorKey,
  isUnavailable,
  type Customer,
  type Order,
  type ListResult,
} from './api.js';
export default function Assignment() {
  const { id } = useParams();
  return <AssignmentEditor key={id} id={id!} />;
}
function AssignmentEditor({ id }: { id: string }) {
  const permission = useAccess('assignCustomer');
  const { t } = useTranslation();
  const orderRequest = useListData<{ data: Order }>(
    `/orders/${id}/assignment`,
    {
      active: permission.can,
    },
  );
  const [page, setPage] = useState(1);
  const options = useListData<ListResult<Customer>>(
    `/orders/customerOptions?page=${page}&pageSize=20`,
    { active: permission.can },
  );
  const order = orderRequest.data?.data;
  const [error, setError] = useState<unknown>();
  const terminal = isUnavailable(error);
  const ready =
    !terminal &&
    !permission.isPending &&
    permission.can &&
    !orderRequest.loading &&
    !orderRequest.error &&
    Boolean(order);
  const api = useApiClient();
  const toaster = useToaster();
  const navigate = useNavigate();
  const location = useLocation();
  const { reload } = useOutletContext<{ reload: () => void }>();
  const { session } = useAuthentication();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const submission = useSubmission({
    scope: `${session?.user.id}:order:${id}`,
  });
  const leave = useSettingsLeave(
    Boolean(customer),
    submission.submitting || submission.pending,
  );
  const save = async () => {
    if (!customer || !order || !ready) return;
    setError(undefined);
    try {
      const result = await submission.run(
        { customerId: customer.id },
        (key, signal, body) =>
          api.request({
            path: `/orders/${order.id}/assignCustomer`,
            method: 'POST',
            json: body,
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      if (!result) return;
      leave.allow();
      reload();
      toaster.show({ type: 'success', title: t('access.saved') });
      await navigate({ pathname: '/orders', search: location.search });
    } catch (error) {
      setError(error);
      if (isUnavailable(error)) {
        leave.allow();
        reload();
      }
    }
  };
  const items =
    options.loading || options.error ? [] : (options.data?.data ?? []);
  return (
    <>
      <RouteDialog
        title={t('access.assignCustomer')}
        description={
          order
            ? t('access.assignmentHint', { number: order.number })
            : undefined
        }
        beforeClose={leave.guard}
        closeTo={{ pathname: '/orders', search: location.search }}
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
                        pathname: '/orders',
                        search: location.search,
                      });
                  })();
                }}
              >
                {t('access.cancel')}
              </Button>
              <Button
                disabled={
                  !customer ||
                  submission.submitting ||
                  options.loading ||
                  Boolean(options.error)
                }
                onClick={() => void save()}
              >
                {t(submission.submitting ? 'access.saving' : 'access.save')}
              </Button>
            </>
          ) : terminal || isUnavailable(orderRequest.error) ? (
            <Button
              variant='outline'
              onClick={() => {
                leave.allow();
                reload();
                void navigate({ pathname: '/orders', search: location.search });
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
                permission.isPending || (permission.can && orderRequest.loading)
              }
              error={terminal ? error : orderRequest.error}
              retry={orderRequest.reload}
            />
            {!permission.isPending && !permission.can ? (
              <p role='alert'>{t('access.denied')}</p>
            ) : null}
          </>
        ) : (
          <div className='space-y-4'>
            <Feedback
              loading={options.loading}
              error={options.error}
              retry={options.reload}
            />
            <Label htmlFor='customer-choice'>
              {t('access.selectCustomer')}
            </Label>
            <Combobox
              items={items}
              value={customer}
              itemToStringLabel={(item: Customer) => item.name}
              onValueChange={setCustomer}
            >
              <ComboboxTrigger
                id='customer-choice'
                render={
                  <Button
                    variant='outline'
                    className='w-full justify-between font-normal'
                  />
                }
                disabled={
                  submission.submitting ||
                  options.loading ||
                  Boolean(options.error)
                }
              >
                {customer?.name ?? t('access.selectCustomer')}
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput
                  aria-label={t('access.search')}
                  placeholder={t('access.search')}
                  showTrigger={false}
                />
                <ComboboxList>
                  {(item: Customer) => (
                    <ComboboxItem key={item.id} value={item}>
                      {item.name}
                    </ComboboxItem>
                  )}
                </ComboboxList>
                <ComboboxEmpty>{t('access.noCustomers')}</ComboboxEmpty>
              </ComboboxContent>
            </Combobox>
            <div className='flex items-center gap-3'>
              <Button
                variant='outline'
                disabled={page === 1 || options.loading}
                onClick={() => {
                  setCustomer(null);
                  setPage(page - 1);
                }}
              >
                {t('access.previous')}
              </Button>
              <span>{page}</span>
              <Button
                variant='outline'
                disabled={
                  page * 20 >= (options.data?.meta.total ?? 0) ||
                  options.loading
                }
                onClick={() => {
                  setCustomer(null);
                  setPage(page + 1);
                }}
              >
                {t('access.next')}
              </Button>
            </div>
            {error ? <p role='alert'>{t(errorKey(error))}</p> : null}
          </div>
        )}
      </RouteDialog>
      {leave.dialog}
    </>
  );
}
