import {
  useCustomers,
  focusCustomerSearch,
  useCustomerOverlayFocus,
} from './context.js';
import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router';
import { ApiClientError, useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDrawer } from '#components/route-drawer';
import { LongText } from '#components/long-text';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';
import { Skeleton } from '#components/ui/skeleton';
import { CustomerError, StatusBadge, DateText } from './shared.js';
import { CustomerActions } from './customer-actions.js';
import type { Customer } from './types.js';
export default function CustomerDetail() {
  useCustomerOverlayFocus();
  const { customerId } = useParams();
  const api = useApiClient();
  const { t } = useTranslation();
  const parent = useCustomers();
  const { reload } = parent;
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer>();
  const [error, setError] = useState<unknown>();
  const [revision, setRevision] = useState(0);
  const candidates = [
    parent.updates[customerId ?? ''],
    parent.customers.find((item) => item.id === customerId),
  ].filter((item): item is Customer => !!item);
  const cached = candidates.sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  )[0];
  const missing = parent.missingIds.includes(customerId ?? '');
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Customer }>({
        path: `customers/${customerId}`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (!controller.signal.aborted) {
            setCustomer(data);
            setError(undefined);
          }
        },
        (next: unknown) => {
          if (!controller.signal.aborted) {
            setError(next);
            if (next instanceof ApiClientError && next.status === 404) reload();
          }
        },
      );
    return () => controller.abort();
  }, [api, customerId, revision, reload, parent.refreshVersion]);
  const current =
    cached && customer && cached.updatedAt > customer.updatedAt
      ? cached
      : customer;
  return (
    <RouteDrawer
      title={current?.title ?? t('customers.detail')}
      footer={
        <>
          {current && !error && !missing && (
            <CustomerActions customer={current} detail />
          )}
          <Button
            variant='outline'
            onClick={() => {
              void navigate(`/customers${parent.search}`);
              focusCustomerSearch();
            }}
          >
            {t('customers.back')}
          </Button>
        </>
      }
    >
      <div className='flex flex-col gap-6'>
        <CustomerError
          reading
          error={error}
          title={current?.title}
          retry={() => setRevision((n) => n + 1)}
        />
        {!current && !error && (
          <div
            aria-label={t('customers.loading')}
            className='flex flex-col gap-4'
          >
            {[1, 2, 3].map((row) => (
              <div key={row} className='grid grid-cols-[8rem_1fr] gap-3'>
                <Skeleton className='h-5 w-3/4' />
                <Skeleton className='h-5 w-full' />
              </div>
            ))}
          </div>
        )}
        {missing && (
          <Alert variant='destructive'>
            <AlertDescription>
              {t('customers.namedMissing', { title: current?.title })}
            </AlertDescription>
          </Alert>
        )}
        {current && !error && !missing && (
          <>
            <div className='flex items-center justify-between'>
              <StatusBadge status={current.status} />
            </div>
            <dl className='flex flex-col gap-4 text-sm'>
              {(
                [
                  ['contact', current.contact || '—'],
                  ['salesOwner', current.salesOwnerName ?? '—'],
                  [
                    'nextFollowUpDate',
                    <DateText
                      key='due'
                      value={current.nextFollowUpDate}
                      empty='—'
                    />,
                  ],
                  [
                    'updatedAt',
                    <DateText
                      key='updated'
                      value={current.updatedAt}
                      timestamp
                    />,
                  ],
                ] as const
              ).map(([key, value]) => (
                <div
                  key={String(key)}
                  className='grid grid-cols-[8rem_1fr] gap-3'
                  onDoubleClick={() => {
                    if (current.permissions.edit && key !== 'updatedAt')
                      void navigate(
                        `/customers/${customerId}/edit${parent.search}`,
                      );
                  }}
                >
                  <dt className='mb-1 text-muted-foreground'>
                    {t(`customers.${key}`)}
                  </dt>
                  <dd className='min-w-0 break-words'>{value}</dd>
                </div>
              ))}
            </dl>
            <section
              className='flex flex-col gap-2'
              onDoubleClick={() => {
                if (current.permissions.edit)
                  void navigate(
                    `/customers/${customerId}/edit${parent.search}`,
                  );
              }}
            >
              <h3 className='text-sm font-medium'>
                {t('customers.description')}
              </h3>
              <LongText className='text-sm'>
                {current.description || '—'}
              </LongText>
            </section>
          </>
        )}
      </div>
      <Outlet />
    </RouteDrawer>
  );
}
