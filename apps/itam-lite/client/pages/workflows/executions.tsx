import type { ReactElement } from 'react';
import { Outlet, useLocation, useMatch, useSearchParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { RecordLink } from '#components/record-link';
import { Badge } from '#components/ui/badge';
import { WorkflowExecutionList } from '#extensions/nocobase-workflow-management/execution-list';
import { DataState } from './shared.js';
import { useWorkflowData, useWorkflowLabels, workflowDate } from './hooks.js';

interface Execution {
  workflowId: string;
  recordId: string;
  title: string;
  state: string;
  createdAt: string;
}

export default function ExecutionsPage(): ReactElement {
  const detail = useMatch({
    path: '/settings/workflows/executions/:workflowId/:recordId',
    end: false,
  });
  const { t, i18n } = useTranslation();
  const labels = useWorkflowLabels();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const workflowId = search.get('workflowId') ?? '';
  const page = Math.max(1, Number(search.get('page')) || 1);
  const query = new URLSearchParams({
    page: String(page),
    pageSize: '20',
    ...(workflowId ? { workflowId } : {}),
  });
  const request = useWorkflowData<{
    data: Execution[];
    meta: { total: number };
  }>(`workflows/executions?${query}`);
  const total = request.data?.meta.total ?? 0;
  const changePage = (next: number) => {
    const params = new URLSearchParams(search);
    params.set('page', String(next));
    setSearch(params);
  };
  if (detail) return <Outlet />;
  return (
    <WorkflowExecutionList
      rows={(request.data?.data ?? []).map((execution) => ({
        id: `${execution.workflowId}:${execution.recordId}`,
        record: (
          <RecordLink
            to={{
              pathname: `/settings/workflows/executions/${execution.workflowId}/${execution.recordId}`,
              search: location.search,
            }}
          >
            {execution.title}
          </RecordLink>
        ),
        workflow: (
          <RecordLink
            to={`/settings/workflows/definitions/${execution.workflowId}`}
          >
            {labels.title(execution.workflowId)}
          </RecordLink>
        ),
        state: (
          <Badge variant='secondary'>{labels.state(execution.state)}</Badge>
        ),
        createdAt: workflowDate(execution.createdAt, i18n.language),
      }))}
      filters={
        workflowId ? (
          <Badge variant='secondary'>{labels.title(workflowId)}</Badge>
        ) : null
      }
      status={<DataState {...request} retry={request.reload} />}
      empty={t('workflows.emptyExecutions')}
      loaded={Boolean(request.data)}
      loading={request.loading}
      labels={{
        refresh: t('workflows.refresh'),
        record: t('workflows.record'),
        workflow: t('workflows.workflow'),
        state: t('workflows.state'),
        createdAt: t('workflows.createdAt'),
        previous: t('workflows.previous'),
        next: t('workflows.next'),
      }}
      order='newest'
      onSort={() => undefined}
      onRefresh={request.reload}
      pagination={t('workflows.pagination', { page, total })}
      previousDisabled={page <= 1 || request.loading}
      nextDisabled={page * 20 >= total || request.loading}
      onPrevious={() => changePage(page - 1)}
      onNext={() => changePage(page + 1)}
    />
  );
}
