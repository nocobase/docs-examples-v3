import type { ReactElement } from 'react';
import { Outlet, useMatch } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { RecordLink } from '#components/record-link';
import { WorkflowDefinitionList } from '#extensions/nocobase-workflow-management/definition-list';
import { DataState } from './shared.js';
import { useWorkflowData, useWorkflowLabels, workflowDate } from './hooks.js';

export interface WorkflowSummary {
  id: string;
  name: string;
  states: number;
  transitions: number;
  executionCount: number;
  lastExecutedAt: string | null;
}

export default function DefinitionsPage(): ReactElement {
  const detail = useMatch({
    path: '/settings/workflows/definitions/:workflowId',
    end: false,
  });
  const { t, i18n } = useTranslation();
  const labels = useWorkflowLabels();
  const request = useWorkflowData<{ data: WorkflowSummary[] }>(
    'workflows/definitions',
  );
  if (detail) return <Outlet />;
  return (
    <WorkflowDefinitionList
      rows={(request.data?.data ?? []).map((workflow) => ({
        id: workflow.id,
        name: workflow.name,
        title: (
          <RecordLink to={`/settings/workflows/definitions/${workflow.id}`}>
            {labels.title(workflow.name)}
          </RecordLink>
        ),
        activity:
          workflow.executionCount > 0 ? (
            <>
              <RecordLink
                to={`/settings/workflows/executions?workflowId=${workflow.id}`}
              >
                {t('workflows.executionCountLink', {
                  count: workflow.executionCount,
                })}
              </RecordLink>
              <p className='text-xs text-muted-foreground'>
                {t('workflows.lastExecutedAt', {
                  date: workflowDate(workflow.lastExecutedAt, i18n.language),
                })}
              </p>
            </>
          ) : (
            <span className='text-muted-foreground'>
              {t('workflows.neverExecuted')}
            </span>
          ),
      }))}
      search={null}
      status={<DataState {...request} retry={request.reload} />}
      empty={t('workflows.emptyDefinitions')}
      loaded={Boolean(request.data)}
      loading={request.loading}
      labels={{
        refresh: t('workflows.refresh'),
        workflow: t('workflows.workflow'),
        executionCount: t('workflows.executionCount'),
        executionActivity: t('workflows.executionActivity'),
      }}
      onRefresh={request.reload}
    />
  );
}
