import {
  useCustomers,
  focusCustomerSearch,
  useCustomerOverlayFocus,
} from './context.js';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  ApiClientError,
  useApiClient,
  useToaster,
  useSubmission,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation, useLocale } from '@nocobase/i18n/client';
import { enUS, zhCN } from 'react-day-picker/locale';
import { CalendarIcon, LoaderCircle } from 'lucide-react';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { Textarea } from '#components/ui/textarea';
import { Alert, AlertDescription } from '#components/ui/alert';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '#components/ui/select';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '#components/ui/popover';
import { Calendar } from '#components/ui/calendar';
import { Skeleton } from '#components/ui/skeleton';
import { useCustomerLeave } from './use-customer-leave.js';
import { SalesOwnerPicker } from './salesOwner-picker.js';
import { CustomerError, DateText } from './shared.js';
import { statuses, type Customer, type CustomerStatus } from './types.js';
interface Fields {
  title: string;
  contact: string;
  description: string;
  salesOwner: { id: string; name: string } | null;
  nextFollowUpDate: string | null;
  status: CustomerStatus;
}
const initial: Fields = {
  title: '',
  contact: '',
  description: '',
  salesOwner: null,
  nextFollowUpDate: null,
  status: 'lead',
};
export default function CustomerForm() {
  useCustomerOverlayFocus();
  const { customerId } = useParams();
  const creating = !customerId;
  const api = useApiClient();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const parent = useCustomers();
  const { reload } = parent;
  const navigate = useNavigate();
  const location = useLocation();
  const toaster = useToaster();
  const { can } = useCan({
    resource: { type: 'composite', id: 'customers' },
    action: creating ? 'create' : 'edit',
  });
  const [fields, setFields] = useState<Fields>(initial);
  const [version, setVersion] = useState('');
  const [loadedTitle, setLoadedTitle] = useState<string>();
  const [loading, setLoading] = useState(!creating);
  const { session } = useAuthentication();
  const submission = useSubmission({
    scope: `${session?.user.id}:customers:${customerId ?? 'new'}:form`,
  });
  const busy = submission.submitting;
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<unknown>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [revision, setRevision] = useState(0);
  const composingRef = useRef(false);
  const leave = useCustomerLeave(dirty, busy || submission.pending, undefined, {
    title: t('customers.discardTitle', {
      title: loadedTitle ?? (fields.title.trim() || t('customers.new')),
    }),
    description: t('customers.discardHint'),
    confirmLabel: t('customers.discard'),
  });
  const nested = location.pathname.endsWith(`/${customerId}/edit`);
  const fatal =
    error instanceof ApiClientError && [401, 403, 404].includes(error.status);
  const closeTo =
    creating || fatal
      ? '/customers'
      : nested
        ? `/customers/${customerId}`
        : '/customers';
  const close = () => {
    void (async () => {
      if (await leave.guard()) {
        leave.allow();
        void navigate(`${closeTo}${parent.search}`, { replace: true });
        if (!nested) focusCustomerSearch();
      }
    })();
  };
  useEffect(() => {
    if (creating) return;
    const controller = new AbortController();
    void api
      .request<{ data: Customer }>({
        path: `customers/${customerId}/edit`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (controller.signal.aborted) return;
          setFields({
            title: data.title,
            contact: data.contact,
            description: data.description,
            salesOwner: data.salesOwnerId
              ? {
                  id: data.salesOwnerId,
                  name: data.salesOwnerName ?? data.salesOwnerId,
                }
              : null,
            nextFollowUpDate: data.nextFollowUpDate,
            status: data.status,
          });
          setVersion(data.updatedAt);
          setLoadedTitle(data.title);
          setDirty(false);
          setErrors({});
          setError(undefined);
          setLoading(false);
        },
        (next: unknown) => {
          if (!controller.signal.aborted) {
            setError(next);
            if (next instanceof ApiClientError && next.status === 404) reload();
            setLoading(false);
          }
        },
      );
    return () => controller.abort();
  }, [api, customerId, creating, revision, reload]);
  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((old) => ({ ...old, [key]: value }));
    setDirty(true);
    setErrors((old) => {
      const next = { ...old };
      delete next[key];
      if (submitted && key === 'title' && typeof value === 'string') {
        const title = value.trim();
        if (!title) next.title = t('customers.titleRequired');
        else if (title.length > 120) next.title = t('customers.titleLong');
      }
      if (
        submitted &&
        key === 'contact' &&
        typeof value === 'string' &&
        value.length > 255
      )
        next.contact = t('customers.contactLong');
      if (
        submitted &&
        key === 'description' &&
        typeof value === 'string' &&
        value.length > 2000
      )
        next.description = t('customers.descriptionLong');
      return next;
    });
  };
  const validate = () => {
    const next: Record<string, string> = {};
    if (!fields.title.trim()) next.title = t('customers.titleRequired');
    else if (fields.title.trim().length > 120)
      next.title = t('customers.titleLong');
    if (fields.contact.length > 255) next.contact = t('customers.contactLong');
    if (fields.description.length > 2000)
      next.description = t('customers.descriptionLong');
    return next;
  };
  const focusField = (field: string) =>
    requestAnimationFrame(() =>
      document.getElementById(`customer-${field}`)?.focus(),
    );
  const save = async () => {
    if (busy || composingRef.current || !can) return;
    setError(undefined);
    const values = {
      title: fields.title.trim(),
      contact: fields.contact.trim(),
      description: fields.description.trim(),
      salesOwnerId: fields.salesOwner?.id ?? null,
      nextFollowUpDate: fields.nextFollowUpDate,
      ...(creating
        ? { status: fields.status }
        : { expectedUpdatedAt: version }),
    };
    try {
      const saved = await submission.run(
        values,
        async (key, signal, snapshot) => {
          setSubmitted(true);
          const next = validate();
          setErrors(next);
          if (Object.keys(next).length) {
            focusField(Object.keys(next)[0]);
            return;
          }
          return api.request<{ data: Customer }>({
            path: creating ? 'customers' : `customers/${customerId}`,
            method: creating ? 'POST' : 'PATCH',
            json: snapshot,
            headers: { 'Idempotency-Key': key },
            signal,
          });
        },
      );
      if (!saved) return;
      const { data } = saved;
      leave.allow();
      setDirty(false);
      parent.changed(data, creating);
      toaster.show({
        type: 'success',
        title: t(creating ? 'customers.created' : 'customers.saved', {
          title: data.title,
        }),
      });
      if (!creating)
        void navigate(`${closeTo}${parent.search}`, { replace: true });
      if (!nested) focusCustomerSearch();
    } catch (next) {
      if (
        next instanceof ApiClientError &&
        next.reason === 'CUSTOMER_ASSIGNEE_INVALID'
      ) {
        setErrors({ salesOwner: t('customers.ownerInvalid') });
        focusField('salesOwner');
      } else if (next instanceof ApiClientError && next.status === 400) {
        const violations =
          (
            next.payload as {
              error?: { fieldViolations?: { field: string }[] };
            }
          ).error?.fieldViolations ?? [];
        const fieldErrors: Record<string, string> = {};
        for (const item of violations) {
          const field = item.field.replace(/^body\.|^json\./u, '');
          if (
            [
              'title',
              'contact',
              'description',
              'salesOwnerId',
              'nextFollowUpDate',
            ].includes(field)
          )
            fieldErrors[field === 'salesOwnerId' ? 'salesOwner' : field] = t(
              field === 'title'
                ? 'customers.titleInvalid'
                : field === 'contact'
                  ? 'customers.contactLong'
                  : field === 'description'
                    ? 'customers.descriptionLong'
                    : field === 'nextFollowUpDate'
                      ? 'customers.dateInvalid'
                      : 'customers.ownerInvalid',
            );
        }
        if (Object.keys(fieldErrors).length) {
          setErrors(fieldErrors);
          focusField(Object.keys(fieldErrors)[0]);
        } else setError(next);
      } else {
        setError(next);
        if (next instanceof ApiClientError && next.status === 404 && customerId)
          parent.removed(customerId, false);
      }
    }
  };
  // The description's minimum height fits a short paragraph; other field widths follow the dialog grid.
  // Explicit labels and error ids accommodate the composed calendar and searchable salesOwner controls.
  return (
    <RouteDialog
      title={t(creating ? 'customers.new' : 'customers.edit')}
      description={t('customers.formHint')}
      beforeClose={leave.guard}
      closeTo={`${closeTo}${parent.search}`}
      footer={
        <>
          <Button variant='outline' disabled={busy} onClick={close}>
            {t(fatal ? 'customers.back' : 'customers.cancel')}
          </Button>
          {can && !fatal && (
            <Button
              type='submit'
              form='customer-form'
              disabled={
                busy ||
                loading ||
                (!creating && !version) ||
                (error instanceof ApiClientError && error.status === 409)
              }
            >
              {busy && <LoaderCircle className='animate-spin' />}
              {t(
                busy
                  ? 'customers.saving'
                  : creating
                    ? 'customers.create'
                    : 'customers.save',
              )}
            </Button>
          )}
        </>
      }
    >
      {leave.dialog}
      <CustomerError
        reading={!creating && !version}
        error={error}
        title={loadedTitle}
        retry={
          !creating && !version ? () => setRevision((n) => n + 1) : undefined
        }
        reload={() => {
          void (async () => {
            if (!(await leave.guard())) return;
            leave.reset();
            setLoading(true);
            setRevision((n) => n + 1);
          })();
        }}
      />
      {!can ? (
        <Alert variant='destructive'>
          <AlertDescription>{t('customers.denied')}</AlertDescription>
        </Alert>
      ) : loading ? (
        <div
          aria-label={t('customers.loading')}
          className='flex flex-col gap-5'
        >
          {[1, 2, 3, 4].map((field) => (
            <div key={field} className='flex flex-col gap-2'>
              <Skeleton className='h-4 w-1/4' />
              <Skeleton className='h-9 w-full' />
            </div>
          ))}
        </div>
      ) : (
        !fatal && (
          <form
            id='customer-form'
            className='flex flex-col gap-5'
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
          >
            <div className='flex flex-col gap-2'>
              <Label htmlFor='customer-title'>
                {t('customers.customerTitle')}{' '}
                <span className='text-destructive'>*</span>
              </Label>
              <Input
                id='customer-title'
                autoFocus
                required
                disabled={busy}
                value={fields.title}
                onChange={(event) => update('title', event.target.value)}
                aria-invalid={!!errors.title}
                aria-describedby={
                  errors.title ? 'customer-title-error' : undefined
                }
              />
              {errors.title && (
                <p
                  id='customer-title-error'
                  role='alert'
                  className='text-sm text-destructive'
                >
                  {errors.title}
                </p>
              )}
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='customer-contact'>{t('customers.contact')}</Label>
              <Input
                id='customer-contact'
                disabled={busy}
                value={fields.contact}
                onChange={(event) => update('contact', event.target.value)}
                aria-invalid={!!errors.contact}
                aria-describedby={
                  errors.contact ? 'customer-contact-error' : undefined
                }
              />
              {errors.contact && (
                <p
                  id='customer-contact-error'
                  role='alert'
                  className='text-sm text-destructive'
                >
                  {errors.contact}
                </p>
              )}
            </div>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='customer-description'>
                {t('customers.description')}
              </Label>
              <Textarea
                id='customer-description'
                className='min-h-28'
                disabled={busy}
                value={fields.description}
                onChange={(event) => update('description', event.target.value)}
                aria-invalid={!!errors.description}
                aria-describedby={
                  errors.description ? 'customer-description-error' : undefined
                }
              />
              {errors.description && (
                <p
                  id='customer-description-error'
                  role='alert'
                  className='text-sm text-destructive'
                >
                  {errors.description}
                </p>
              )}
            </div>
            <div className='grid gap-5 sm:grid-cols-2'>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='customer-salesOwner'>
                  {t('customers.salesOwner')}
                </Label>
                <SalesOwnerPicker
                  value={fields.salesOwner}
                  onChange={(value) => update('salesOwner', value)}
                  disabled={busy}
                  invalid={!!errors.salesOwner}
                />
                {errors.salesOwner && (
                  <p
                    id='customer-salesOwner-error'
                    role='alert'
                    className='text-sm text-destructive'
                  >
                    {errors.salesOwner}
                  </p>
                )}
              </div>
              <div className='flex flex-col gap-2'>
                <Label htmlFor='customer-nextFollowUpDate'>
                  {t('customers.nextFollowUpDate')}
                </Label>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        id='customer-nextFollowUpDate'
                        aria-invalid={!!errors.nextFollowUpDate}
                        aria-describedby={
                          errors.nextFollowUpDate
                            ? 'customer-nextFollowUpDate-error'
                            : undefined
                        }
                        variant='outline'
                        disabled={busy}
                        className='w-full justify-start font-normal'
                      >
                        <CalendarIcon />
                        <DateText value={fields.nextFollowUpDate} />
                      </Button>
                    }
                  />
                  <PopoverContent className='w-auto p-0' align='start'>
                    <Calendar
                      mode='single'
                      locale={locale.startsWith('zh') ? zhCN : enUS}
                      selected={
                        fields.nextFollowUpDate
                          ? new Date(`${fields.nextFollowUpDate}T12:00:00`)
                          : undefined
                      }
                      onSelect={(date) =>
                        update(
                          'nextFollowUpDate',
                          date
                            ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                            : null,
                        )
                      }
                    />
                    <Button
                      variant='ghost'
                      className='w-full'
                      onClick={() => update('nextFollowUpDate', null)}
                    >
                      {t('customers.clearDate')}
                    </Button>
                  </PopoverContent>
                </Popover>
                {errors.nextFollowUpDate && (
                  <p
                    id='customer-nextFollowUpDate-error'
                    role='alert'
                    className='text-sm text-destructive'
                  >
                    {errors.nextFollowUpDate}
                  </p>
                )}
              </div>
            </div>
            {creating && (
              <div className='flex flex-col gap-2'>
                <Label htmlFor='customer-status'>{t('customers.status')}</Label>
                <Select
                  value={fields.status}
                  onValueChange={(value) =>
                    update('status', value as CustomerStatus)
                  }
                  disabled={busy}
                >
                  <SelectTrigger id='customer-status' className='w-full'>
                    <SelectValue>{t(`customers.${fields.status}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className='w-auto min-w-(--anchor-width) max-w-[min(var(--container-sm),var(--available-width))] [&_[data-slot=select-item]>:first-child]:whitespace-normal'>
                    {statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`customers.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </form>
        )
      )}
    </RouteDialog>
  );
}
