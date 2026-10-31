import { useCan } from '@nocobase/app-plugin-authorization/client';
import { Link, Outlet, useLocation, useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDrawer } from '#components/route-drawer';
import { Button } from '#components/ui/button';
import { StatusBadge } from '#components/status-badge';
import { useListData } from '#hooks/use-list-data';
import { useCustomerContext } from './context.js';
import { errorKey, type Customer } from './api.js';
export default function CustomerDetail() {
  const { id } = useParams();
  const { can: canEdit } = useCan({
    resource: { type: 'composite', id: 'customers' },
    action: 'edit',
  });
  const { search } = useLocation();
  const { t } = useTranslation();
  const parent = useCustomerContext();
  const request = useListData<{ data: Customer }>(
    `customerRecord/${encodeURIComponent(id ?? '')}`,
  );
  const customer = request.data?.data;
  return (
    <RouteDrawer
      title={customer?.name ?? t('customers.details')}
      footer={
        customer && !request.error && canEdit ? (
          <Button nativeButton={false} render={<Link to={`edit${search}`} />}>
            {t('customers.edit')}
          </Button>
        ) : undefined
      }
    >
      {request.error ? (
        <p role='alert'>{t(errorKey(request.error))}</p>
      ) : customer ? (
        <dl className='grid gap-5'>
          {(['name', 'contact', 'email', 'status'] as const).map((field) => (
            <div key={field}>
              <dt className='text-sm text-muted-foreground'>
                {t(`customers.${field}`)}
              </dt>
              <dd className='mt-1 font-medium'>
                {field === 'status' ? (
                  <StatusBadge
                    tone={customer.status === 'active' ? 'success' : 'neutral'}
                  >
                    {t(`customers.${customer.status}`)}
                  </StatusBadge>
                ) : (
                  customer[field]
                )}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p role='status'>{t('customers.loading')}</p>
      )}
      <Outlet
        context={{
          reload: () => {
            request.reload();
            parent.reload();
          },
        }}
      />
    </RouteDrawer>
  );
}
