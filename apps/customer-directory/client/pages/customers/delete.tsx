import { useState } from 'react';
import { useApiClient, useSubmission } from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { Alert, AlertDescription } from '#components/ui/alert';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '#components/ui/alert-dialog';
import type { Customer } from './api.js';
import { errorKey } from './api.js';
export function DeleteCustomer({
  customer,
  open,
  onOpenChange,
  onDeleted,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const { session } = useAuthentication();
  const submission = useSubmission({
    scope: `${session?.user.id}:customers:delete:${customer?.id}`,
  });
  const [error, setError] = useState<unknown>();
  async function remove() {
    if (!customer) return;
    setError(undefined);
    try {
      const result = await submission.run(
        { id: customer.id },
        (key, signal, input) =>
          api.repository<Customer>('customers').deleteOne({
            filter: { id: input.id },
            idempotencyKey: key,
            signal,
          }),
      );
      if (!result) return;
      onOpenChange(false);
      onDeleted();
    } catch (e) {
      setError(e);
    }
  }
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!submission.submitting && !submission.pending) onOpenChange(v);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('customers.deleteTitle', { name: customer?.name })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('customers.deleteDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <Alert variant='destructive'>
            <AlertDescription>
              {t(
                submission.pending
                  ? 'customers.uncertainDelete'
                  : errorKey(error),
              )}
            </AlertDescription>
          </Alert>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={submission.submitting || submission.pending}
          >
            {t('customers.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            onClick={() => void remove()}
            disabled={submission.submitting}
          >
            {t(
              submission.submitting
                ? 'customers.saving'
                : submission.pending
                  ? 'customers.retry'
                  : 'customers.delete',
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
