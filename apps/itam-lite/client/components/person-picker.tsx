import { useEffect, useMemo, useState } from 'react';
import { useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '#components/ui/combobox';
import { Button } from '#components/ui/button';
import { Skeleton } from '#components/ui/skeleton';

export interface Person {
  id: string;
  name: string;
}

/**
 * Searches people through a feature's own endpoint (such as `devices/people`), so the list is authorized by that
 * feature's permissions rather than by user administration.
 */
export function PersonPicker({
  id,
  path,
  value,
  onChange,
  disabled,
  invalid,
  allowEmpty = true,
}: {
  id: string;
  path: string;
  value: Person | null;
  onChange: (value: Person | null) => void;
  disabled?: boolean;
  invalid?: boolean;
  allowEmpty?: boolean;
}) {
  const api = useApiClient();
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [settled, setSettled] = useState('');
  const requestKey = `${q}|${page}`;
  const loading = settled !== requestKey;
  const none = useMemo(() => ({ id: '', name: t('devices.unassigned') }), [t]);
  useEffect(() => {
    const controller = new AbortController();
    void api
      .request<{ data: Person[]; meta: { total: number } }>({
        path: `${path}?${new URLSearchParams({ q, page: String(page), pageSize: '20' })}`,
        signal: controller.signal,
      })
      .then(
        (result) => {
          if (controller.signal.aborted) return;
          setPeople((old) =>
            page === 1
              ? result.data
              : [
                  ...old,
                  ...result.data.filter(
                    (item) => !old.some((u) => u.id === item.id),
                  ),
                ],
          );
          setTotal(result.meta.total);
          setSettled(requestKey);
        },
        () => {
          if (!controller.signal.aborted) setSettled(requestKey);
        },
      );
    return () => controller.abort();
  }, [api, path, q, page, requestKey]);
  const items = [
    ...(allowEmpty ? [none] : []),
    ...(value && !people.some((p) => p.id === value.id) ? [value] : []),
    ...people,
  ];
  return (
    <Combobox
      items={items}
      value={value ?? (allowEmpty ? none : null)}
      itemToStringLabel={(item: Person) => item.name}
      itemToStringValue={(item: Person) => item.id}
      isItemEqualToValue={(a: Person, b: Person) => a.id === b.id}
      filter={null}
      onValueChange={(item: Person | null) => onChange(item?.id ? item : null)}
      onInputValueChange={(text, details) => {
        if (details.reason === 'input-change') {
          setQ(text);
          setPage(1);
          setPeople([]);
        }
      }}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        placeholder={t('devices.searchPeople')}
      />
      <ComboboxContent>
        <ComboboxList>
          {(item: Person) => (
            <ComboboxItem key={item.id} value={item}>
              {item.name}
            </ComboboxItem>
          )}
        </ComboboxList>
        {loading && (
          <div
            role='status'
            aria-label={t('devices.loading')}
            className='flex flex-col gap-2 p-3'
          >
            <Skeleton className='h-5 w-full' />
            <Skeleton className='h-5 w-2/3' />
          </div>
        )}
        {!loading && !people.length && (
          <p className='p-3 text-sm text-muted-foreground'>
            {t('devices.noPeople')}
          </p>
        )}
        {!loading && people.length < total && (
          <Button
            variant='ghost'
            className='w-full'
            onClick={() => setPage((n) => n + 1)}
          >
            {t('devices.loadMore')}
          </Button>
        )}
      </ComboboxContent>
    </Combobox>
  );
}
