import { useEffect, useState, type ReactElement } from 'react';
import {
  ApiClientError,
  createUuid,
  useApiClient,
  useToaster,
} from '@nocobase/app-client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { useTranslation } from '@nocobase/i18n/client';
import { LoaderCircle } from 'lucide-react';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Button } from '#components/ui/button';
import { Checkbox } from '#components/ui/checkbox';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { deviceCategories, type DeviceCategory } from '../devices/types.js';
import { workflowDate } from './hooks.js';

interface ParameterView {
  revision: number;
  origin: 'default' | 'configuration';
  values: { approvalCategories: DeviceCategory[]; deviceLimit: number };
  updatedAt: string | null;
}

/**
 * The approval rules of the device request workflow. Saves the complete group from the revision it read; on a 409
 * the draft stays and the person reloads the latest values deliberately.
 */
export function ApprovalRulesForm({
  workflowId,
}: {
  workflowId: string;
}): ReactElement {
  const api = useApiClient();
  const toaster = useToaster();
  const { t, i18n } = useTranslation();
  const { can: canUpdate } = useCan({
    resource: { type: 'settings', id: 'workflow-management' },
    action: 'update',
  });
  const path = `workflows/definitions/${workflowId}/parameters`;
  const [current, setCurrent] = useState<ParameterView>();
  const [categories, setCategories] = useState<DeviceCategory[]>([]);
  const [limit, setLimit] = useState('');
  const [limitError, setLimitError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [key, setKey] = useState(() => createUuid());

  useEffect(() => {
    void api.request<{ data: ParameterView }>({ path }).then(({ data }) => {
      setCurrent(data);
      setCategories(data.values.approvalCategories);
      setLimit(String(data.values.deviceLimit));
      setConflict(false);
    });
  }, [api, path, revision]);

  const save = async () => {
    if (!current) return;
    const deviceLimit = Number(limit);
    if (!/^\d+$/.test(limit) || deviceLimit > 20)
      return setLimitError(t('workflows.invalid'));
    setBusy(true);
    try {
      const { data } = await api.request<{ data: ParameterView }>({
        path,
        method: 'PUT',
        json: {
          values: { approvalCategories: categories, deviceLimit },
          expectedRevision: current.revision,
          requestId: key,
        },
      });
      setCurrent(data);
      setKey(createUuid());
      toaster.show({ type: 'success', title: t('workflows.saved') });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 409)
        setConflict(true);
      else toaster.show({ type: 'error', title: t('workflows.failed') });
    } finally {
      setBusy(false);
    }
  };

  if (!current)
    return (
      <p className='text-sm text-muted-foreground'>{t('workflows.loading')}</p>
    );
  return (
    <form
      className='flex flex-col gap-5'
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {!canUpdate && (
        <Alert>
          <AlertDescription>{t('workflows.readOnly')}</AlertDescription>
        </Alert>
      )}
      {conflict && (
        <Alert variant='destructive'>
          <AlertDescription>
            {t('workflows.parameterConflict')}
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setRevision((n) => n + 1)}
            >
              {t('workflows.reloadLatest')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <fieldset className='flex flex-col gap-2' disabled={!canUpdate || busy}>
        <legend className='text-sm font-medium'>
          {t('workflows.approvalCategories')}
        </legend>
        <p className='text-sm text-muted-foreground'>
          {t('workflows.approvalCategoriesHint')}
        </p>
        <div className='grid grid-cols-2 gap-2'>
          {deviceCategories.map((category) => (
            <div key={category} className='flex items-center gap-2'>
              <Checkbox
                id={`approval-${category}`}
                checked={categories.includes(category)}
                onCheckedChange={(checked) =>
                  setCategories((old) =>
                    checked
                      ? [...old, category]
                      : old.filter((item) => item !== category),
                  )
                }
              />
              <Label htmlFor={`approval-${category}`}>
                {t(`devices.categories.${category}`)}
              </Label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='approval-device-limit'>
          {t('workflows.deviceLimit')}
        </Label>
        <p className='text-sm text-muted-foreground'>
          {t('workflows.deviceLimitHint')}
        </p>
        <Input
          id='approval-device-limit'
          inputMode='numeric'
          className='w-28'
          disabled={!canUpdate || busy}
          value={limit}
          onChange={(event) => {
            setLimit(event.target.value.trim());
            setLimitError('');
          }}
          aria-invalid={!!limitError}
          aria-describedby={
            limitError ? 'approval-device-limit-error' : undefined
          }
        />
        {limitError && (
          <p
            id='approval-device-limit-error'
            role='alert'
            className='text-sm text-destructive'
          >
            {limitError}
          </p>
        )}
      </div>
      <p className='text-xs text-muted-foreground'>
        {current.origin === 'default'
          ? t('workflows.defaultValues')
          : t('workflows.savedBy', {
              revision: current.revision,
              date: workflowDate(current.updatedAt, i18n.language),
            })}{' '}
        {t('workflows.parameterTiming')}
      </p>
      {canUpdate && (
        <div>
          <Button type='submit' disabled={busy || conflict}>
            {busy && <LoaderCircle className='animate-spin' />}
            {t(busy ? 'workflows.saving' : 'workflows.save')}
          </Button>
        </div>
      )}
    </form>
  );
}
