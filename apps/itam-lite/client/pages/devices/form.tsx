import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router';
import { ApiClientError, useApiClient, useToaster } from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { LoaderCircle } from 'lucide-react';
import { RouteDialog } from '#components/route-dialog';
import { PersonPicker, type Person } from '#components/person-picker';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { Textarea } from '#components/ui/textarea';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '#components/ui/select';
import { Skeleton } from '#components/ui/skeleton';
import { DeviceError } from './shared.js';
import type { DevicesOutletContext } from './index.js';
import {
  deviceCategories,
  deviceStatuses,
  type Device,
  type DeviceCategory,
  type DeviceStatus,
} from './types.js';

interface Fields {
  assetTag: string;
  name: string;
  category: DeviceCategory;
  serialNumber: string;
  status: DeviceStatus;
  assignee: Person | null;
  location: string;
  purchaseDate: string;
  notes: string;
}

const initial: Fields = {
  assetTag: '',
  name: '',
  category: 'laptop',
  serialNumber: '',
  status: 'inStock',
  assignee: null,
  location: '',
  purchaseDate: '',
  notes: '',
};

/** Server reasons that belong to one field, and the message shown beside it. */
const fieldReasons: Record<string, [keyof Fields, string]> = {
  DEVICE_ASSET_TAG_TAKEN: ['assetTag', 'devices.errors.assetTagTaken'],
  DEVICE_SERIAL_NUMBER_TAKEN: [
    'serialNumber',
    'devices.errors.serialNumberTaken',
  ],
  DEVICE_ASSIGNEE_REQUIRED: ['assignee', 'devices.errors.assigneeRequired'],
  DEVICE_ASSIGNEE_NOT_ALLOWED: [
    'assignee',
    'devices.errors.assigneeNotAllowed',
  ],
  DEVICE_ASSIGNEE_INVALID: ['assignee', 'devices.errors.assigneeInvalid'],
};

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className='flex flex-col gap-2'>
      <Label htmlFor={id}>
        {label} {required && <span className='text-destructive'>*</span>}
      </Label>
      {children}
      {error && (
        <p id={`${id}-error`} role='alert' className='text-sm text-destructive'>
          {error}
        </p>
      )}
    </div>
  );
}

export default function DeviceForm() {
  const { deviceId } = useParams();
  const creating = !deviceId;
  const api = useApiClient();
  const toaster = useToaster();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { reload, search } = useOutletContext<DevicesOutletContext>();
  const { can } = useCan({
    resource: { type: 'composite', id: 'devices' },
    action: creating ? 'create' : 'edit',
  });
  const [fields, setFields] = useState<Fields>(initial);
  const [loading, setLoading] = useState(!creating);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>(
    {},
  );
  const closeTo = `/devices${search}`;

  useEffect(() => {
    if (creating) return;
    const controller = new AbortController();
    void api
      .request<{ data: Device }>({
        path: `devices/${deviceId}`,
        signal: controller.signal,
      })
      .then(
        ({ data }) => {
          if (controller.signal.aborted) return;
          setFields({
            assetTag: data.assetTag,
            name: data.name,
            category: data.category,
            serialNumber: data.serialNumber ?? '',
            status: data.status,
            assignee: data.assigneeId
              ? {
                  id: data.assigneeId,
                  name: data.assigneeName ?? data.assigneeId,
                }
              : null,
            location: data.location,
            purchaseDate: data.purchaseDate ?? '',
            notes: data.notes,
          });
          setLoading(false);
        },
        (next: unknown) => {
          if (controller.signal.aborted) return;
          setError(next);
          setLoading(false);
        },
      );
    return () => controller.abort();
  }, [api, creating, deviceId]);

  const update = <K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((old) => ({ ...old, [key]: value }));
    setErrors((old) => ({ ...old, [key]: undefined }));
  };
  const validate = () => {
    const next: Partial<Record<keyof Fields, string>> = {};
    const assetTag = fields.assetTag.trim();
    const name = fields.name.trim();
    if (!assetTag) next.assetTag = t('devices.errors.assetTagRequired');
    else if (assetTag.length > 40)
      next.assetTag = t('devices.errors.assetTagLong');
    if (!name) next.name = t('devices.errors.nameRequired');
    else if (name.length > 120) next.name = t('devices.errors.nameLong');
    if (fields.status === 'inUse' && !fields.assignee)
      next.assignee = t('devices.errors.assigneeRequired');
    if (fields.status !== 'inUse' && fields.assignee)
      next.assignee = t('devices.errors.assigneeNotAllowed');
    return next;
  };
  const save = async () => {
    if (busy) return;
    const next = validate();
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) {
      document.getElementById(`device-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const { data } = await api.request<{ data: Device }>({
        path: creating ? 'devices' : `devices/${deviceId}`,
        method: creating ? 'POST' : 'PUT',
        json: {
          assetTag: fields.assetTag.trim(),
          name: fields.name.trim(),
          category: fields.category,
          serialNumber: fields.serialNumber.trim() || null,
          status: fields.status,
          assigneeId: fields.assignee?.id ?? null,
          location: fields.location.trim(),
          purchaseDate: fields.purchaseDate || null,
          notes: fields.notes.trim(),
        },
      });
      toaster.show({
        type: 'success',
        title: t(creating ? 'devices.created' : 'devices.saved', {
          assetTag: data.assetTag,
        }),
      });
      reload();
      void navigate(closeTo, { replace: true });
    } catch (failure) {
      const mapped =
        failure instanceof ApiClientError
          ? fieldReasons[failure.reason ?? '']
          : undefined;
      if (mapped) {
        setErrors({ [mapped[0]]: t(mapped[1]) });
        document.getElementById(`device-${mapped[0]}`)?.focus();
      } else setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RouteDialog
      title={t(creating ? 'devices.new' : 'devices.edit')}
      description={t('devices.formHint')}
      closeTo={closeTo}
      footer={
        <>
          <Button
            variant='outline'
            disabled={busy}
            onClick={() => void navigate(closeTo, { replace: true })}
          >
            {t('devices.cancel')}
          </Button>
          {can && (
            <Button type='submit' form='device-form' disabled={busy || loading}>
              {busy && <LoaderCircle className='animate-spin' />}
              {t(
                busy
                  ? 'devices.saving'
                  : creating
                    ? 'devices.create'
                    : 'devices.save',
              )}
            </Button>
          )}
        </>
      }
    >
      <DeviceError error={error} reading={loading} />
      {loading ? (
        <div aria-label={t('devices.loading')} className='flex flex-col gap-4'>
          {[1, 2, 3, 4].map((n) => (
            <Skeleton key={n} className='h-9 w-full' />
          ))}
        </div>
      ) : (
        <form
          id='device-form'
          className='flex flex-col gap-4'
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field
              id='device-assetTag'
              label={t('devices.assetTag')}
              required
              error={errors.assetTag}
            >
              <Input
                id='device-assetTag'
                autoFocus
                disabled={busy}
                value={fields.assetTag}
                placeholder='IT-2026-0001'
                onChange={(event) => update('assetTag', event.target.value)}
                aria-invalid={!!errors.assetTag}
                aria-describedby={
                  errors.assetTag ? 'device-assetTag-error' : undefined
                }
              />
            </Field>
            <Field
              id='device-serialNumber'
              label={t('devices.serialNumber')}
              error={errors.serialNumber}
            >
              <Input
                id='device-serialNumber'
                disabled={busy}
                value={fields.serialNumber}
                onChange={(event) => update('serialNumber', event.target.value)}
                aria-invalid={!!errors.serialNumber}
                aria-describedby={
                  errors.serialNumber ? 'device-serialNumber-error' : undefined
                }
              />
            </Field>
          </div>
          <Field
            id='device-name'
            label={t('devices.name')}
            required
            error={errors.name}
          >
            <Input
              id='device-name'
              disabled={busy}
              value={fields.name}
              placeholder='MacBook Pro 14 M4'
              onChange={(event) => update('name', event.target.value)}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'device-name-error' : undefined}
            />
          </Field>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field id='device-category' label={t('devices.category')} required>
              <Select
                value={fields.category}
                onValueChange={(value) =>
                  update('category', value as DeviceCategory)
                }
                disabled={busy}
              >
                <SelectTrigger id='device-category' className='w-full'>
                  <SelectValue>
                    {t(`devices.categories.${fields.category}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {deviceCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`devices.categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id='device-status' label={t('devices.status')} required>
              <Select
                value={fields.status}
                onValueChange={(value) =>
                  update('status', value as DeviceStatus)
                }
                disabled={busy}
              >
                <SelectTrigger id='device-status' className='w-full'>
                  <SelectValue>
                    {t(`devices.statuses.${fields.status}`)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {deviceStatuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`devices.statuses.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field
            id='device-assignee'
            label={t('devices.assignee')}
            required={fields.status === 'inUse'}
            error={errors.assignee}
          >
            <PersonPicker
              id='device-assignee'
              path='devices/people'
              value={fields.assignee}
              onChange={(value) => update('assignee', value)}
              disabled={busy}
              invalid={!!errors.assignee}
            />
          </Field>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field id='device-location' label={t('devices.location')}>
              <Input
                id='device-location'
                disabled={busy}
                value={fields.location}
                onChange={(event) => update('location', event.target.value)}
              />
            </Field>
            <Field id='device-purchaseDate' label={t('devices.purchaseDate')}>
              <Input
                id='device-purchaseDate'
                type='date'
                disabled={busy}
                value={fields.purchaseDate}
                onChange={(event) => update('purchaseDate', event.target.value)}
              />
            </Field>
          </div>
          <Field id='device-notes' label={t('devices.notes')}>
            <Textarea
              id='device-notes'
              className='min-h-20'
              disabled={busy}
              value={fields.notes}
              onChange={(event) => update('notes', event.target.value)}
            />
          </Field>
        </form>
      )}
    </RouteDialog>
  );
}
