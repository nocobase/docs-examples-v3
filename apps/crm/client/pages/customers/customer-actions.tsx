import { useCustomers, focusCustomerSearch } from './context.js';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ApiClientError,
  useApiClient,
  useToaster,
  useNavigationGuard,
  useSubmission,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { MoreHorizontal, LoaderCircle } from 'lucide-react';
import { Button } from '#components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '#components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '#components/ui/alert-dialog';
import { CustomerError } from './shared.js';
import type { Customer, CustomerStatus } from './types.js';

export function CustomerActions({
  customer,
  detail = false,
}: {
  customer: Customer;
  detail?: boolean;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const navigate = useNavigate();
  const parent = useCustomers();
  const { session } = useAuthentication();
  const submission = useSubmission({
    scope: `${session?.user.id}:customers:${customer.id}:actions:${detail ? 'detail' : 'row'}`,
  });
  const errorToastId = `customers:${customer.id}:progress-error`;
  const retryRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const progressSnapshotRef = useRef<
    { status: CustomerStatus; expectedUpdatedAt: string } | undefined
  >(undefined);
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [deleting, setDeleting] = useState<Customer>();
  const [deleteReady, setDeleteReady] = useState(false);
  useNavigationGuard(() => !pendingRef.current && !submission.pending);
  const begin = () => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setBusy(true);
    toaster.close(errorToastId);
    setError(undefined);
    return true;
  };
  const finish = () => {
    pendingRef.current = false;
    setBusy(false);
  };
  const fail = (next: unknown) => {
    if (next instanceof ApiClientError && next.status === 404) {
      parent.removed(customer.id);
      setDeleting(undefined);
      finish();
      toaster.show({
        type: 'error',
        title: t('customers.namedMissing', { title: customer.title }),
      });
      if (detail)
        void navigate(`/customers${parent.search}`, { replace: true });
      focusCustomerSearch();
    } else setError(next);
  };
  const progress = async (status: CustomerStatus) => {
    if (!begin()) return;
    retryRef.current = () => progress(status);
    try {
      if (!submission.pending) {
        const { data: current } = await api.request<{ data: Customer }>({
          path: `customers/${customer.id}/progress`,
        });
        progressSnapshotRef.current = {
          status,
          expectedUpdatedAt: current.updatedAt,
        };
      }
      if (!progressSnapshotRef.current) return;
      const saved = await submission.run(
        progressSnapshotRef.current,
        (key, signal, snapshot) =>
          api.request<{ data: Customer }>({
            path: `customers/${customer.id}/status`,
            method: 'PATCH',
            json: snapshot,
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      if (!saved) return;
      retryRef.current = undefined;
      const { data: updated } = saved;
      parent.changed(updated);
      toaster.show({
        type: 'success',
        title: t('customers.progressSaved', { title: updated.title }),
      });
    } catch (next) {
      if (!(next instanceof ApiClientError && next.status === 404)) {
        toaster.show({
          type: 'error',
          id: errorToastId,
          title: t('customers.progressFailed', { title: customer.title }),
        });
      }
      fail(next);
    } finally {
      finish();
    }
  };
  const prepareDelete = async () => {
    if (!begin()) return;
    setDeleting(customer);
    setDeleteReady(false);
    try {
      const { data } = await api.request<{ data: Customer }>({
        path: `customers/${customer.id}/delete`,
      });
      setDeleting(data);
      setDeleteReady(true);
    } catch (next) {
      fail(next);
    } finally {
      finish();
    }
  };
  const remove = async () => {
    if (!deleting || !deleteReady || !begin()) return;
    try {
      retryRef.current = remove;
      const saved = await submission.run(
        { expectedUpdatedAt: deleting.updatedAt },
        (key, signal, snapshot) =>
          api.request({
            path: `customers/${customer.id}?${new URLSearchParams(snapshot)}`,
            method: 'DELETE',
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      if (!saved) return;
      retryRef.current = undefined;
      parent.removed(customer.id);
      setDeleting(undefined);
      finish();
      toaster.show({
        type: 'success',
        title: t('customers.deleted', { title: deleting.title }),
      });
      if (detail)
        void navigate(`/customers${parent.search}`, { replace: true });
      focusCustomerSearch();
    } catch (next) {
      fail(next);
    } finally {
      finish();
    }
  };
  const any =
    customer.permissions.edit ||
    customer.permissions.progress ||
    customer.permissions.delete;
  if (!any) return null;
  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {detail && customer.permissions.edit && (
        <Button
          disabled={busy || submission.pending}
          onClick={() => void navigate(`edit${parent.search}`)}
        >
          {t('customers.editAction')}
        </Button>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              disabled={busy || submission.pending}
              aria-label={t('customers.actions', { title: customer.title })}
            >
              {busy ? (
                <LoaderCircle className='animate-spin' />
              ) : (
                <MoreHorizontal />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align='end' className='w-auto min-w-40'>
          {customer.permissions.edit && !detail && (
            <DropdownMenuItem
              onClick={() =>
                void navigate(
                  detail
                    ? `edit${parent.search}`
                    : `/customers/edit/${customer.id}${parent.search}`,
                )
              }
            >
              {t('customers.editAction')}
            </DropdownMenuItem>
          )}
          {customer.permissions.progress && (
            <>
              {customer.status === 'lead' && (
                <DropdownMenuItem onClick={() => void progress('followingUp')}>
                  {t('customers.start')}
                </DropdownMenuItem>
              )}
              {customer.status !== 'won' && (
                <DropdownMenuItem onClick={() => void progress('won')}>
                  {t('customers.complete')}
                </DropdownMenuItem>
              )}
              {customer.status !== 'lead' && (
                <DropdownMenuItem onClick={() => void progress('lead')}>
                  {t('customers.reopen')}
                </DropdownMenuItem>
              )}
            </>
          )}
          {customer.permissions.delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => void prepareDelete()}
              >
                {t('customers.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {!deleting && (
        <CustomerError
          error={error}
          retry={() => void retryRef.current?.()}
          title={customer.title}
          reload={() => {
            toaster.close(errorToastId);
            setError(undefined);
            parent.reload();
          }}
        />
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !pendingRef.current && !submission.pending) {
            setDeleting(undefined);
            setError(undefined);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('customers.deleteTitle', { title: deleting?.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('customers.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <CustomerError
            error={error}
            title={deleting?.title}
            reload={() => void prepareDelete()}
            retry={() =>
              submission.pending ? void remove() : void prepareDelete()
            }
          />
          <AlertDialogFooter>
            <Button
              variant='outline'
              disabled={busy || submission.pending}
              onClick={() => {
                setDeleting(undefined);
                setError(undefined);
              }}
            >
              {t('customers.cancel')}
            </Button>
            <Button
              variant='destructive'
              disabled={
                busy ||
                !deleteReady ||
                (error instanceof ApiClientError && error.status === 409)
              }
              onClick={() => void remove()}
            >
              {busy && <LoaderCircle className='animate-spin' />}
              {busy ? t('customers.deleting') : t('customers.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
