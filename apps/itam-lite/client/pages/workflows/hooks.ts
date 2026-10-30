import { useCallback, useEffect, useState } from 'react';
import { ApiClientError, useApiClient } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';

/** Reads one management endpoint; keeps the previous data while a refresh is in flight. */
export function useWorkflowData<T>(path: string) {
  const api = useApiClient();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{
    requestKey?: string;
    data?: T;
    status?: number;
  }>({});
  const requestKey = `${path}#${refresh}`;
  useEffect(() => {
    let active = true;
    void api.request<T>({ path }).then(
      (data) => {
        if (active) setResult({ requestKey, data });
      },
      (error: unknown) => {
        const status = error instanceof ApiClientError ? error.status : 500;
        if (active)
          setResult((previous) => ({
            requestKey,
            status,
            data: status === 403 ? undefined : previous.data,
          }));
      },
    );
    return () => {
      active = false;
    };
  }, [api, path, requestKey]);
  const reload = useCallback(() => setRefresh((value) => value + 1), []);
  return {
    data: result.data,
    status: result.status,
    loading: result.requestKey !== requestKey,
    reload,
  };
}

export function useWorkflowLabels() {
  const { t } = useTranslation();
  return {
    title: (name: string) =>
      t(`workflows.names.${name}`, { defaultValue: name }),
    state: (name: string) =>
      t(`requests.states.${name}`, { defaultValue: name }),
    transition: (name: string) =>
      t(`requests.transitions.${name}`, { defaultValue: name }),
    effect: (name: string) =>
      t(`workflows.effectNames.${name.replaceAll('.', '_')}`, {
        defaultValue: name,
      }),
  };
}

export function workflowDate(value: string | null, language: string): string {
  const date = value ? new Date(value) : new Date(Number.NaN);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}
