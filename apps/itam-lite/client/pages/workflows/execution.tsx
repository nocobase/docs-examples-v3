import { useState, type ReactElement } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLocation, useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import type { LifecycleDescription } from '@nocobase/lifecycle';
import { LifecycleDiagram } from '#components/lifecycle-diagram';
import { Button } from '#components/ui/button';
import { WorkflowExecutionDetail } from '#extensions/nocobase-workflow-management/execution-detail';
import { DataState, WorkflowDetailPage } from './shared.js';
import { useWorkflowData, useWorkflowLabels, workflowDate } from './hooks.js';
import type { WorkflowSummary } from './definitions.js';

interface ExecutionDetail {
  workflow: WorkflowSummary;
  description: LifecycleDescription;
  title: string;
  actors: Record<string, string>;
  view: {
    state: string;
    parameterValues?: { approvalCategories?: string[]; deviceLimit?: number };
    history: {
      transitions: {
        id: string;
        version: number;
        at: string;
        transition: string;
        from: string | null;
        to: string;
        actorId: string;
      }[];
      effectRuns: {
        id: string;
        effect: string;
        status: string;
        attempts: number;
        maxAttempts: number;
        error?: string | null;
      }[];
    };
  };
}

export default function ExecutionPage(): ReactElement {
  const { workflowId = '', recordId = '' } = useParams();
  const [refreshVersion, setRefreshVersion] = useState(0);
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const labels = useWorkflowLabels();
  const request = useWorkflowData<{ data: ExecutionDetail }>(
    `workflows/executions/${encodeURIComponent(workflowId)}/${encodeURIComponent(recordId)}`,
  );
  const detail = request.data?.data;
  return (
    <WorkflowDetailPage
      title={
        detail
          ? `${labels.title(detail.workflow.name)} · ${detail.title}`
          : t('workflows.executions')
      }
      titleSuffix={
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={t('workflows.refresh')}
          disabled={request.loading}
          onClick={() => {
            setRefreshVersion((version) => version + 1);
            request.reload();
          }}
        >
          <RefreshCw className={request.loading ? 'animate-spin' : undefined} />
        </Button>
      }
      description={t('workflows.executionDescription')}
      listTitle={t('workflows.executions')}
      closeTo={{
        pathname: '/settings/workflows/executions',
        search: location.search,
      }}
    >
      <DataState {...request} retry={request.reload} />
      {detail && (
        <WorkflowExecutionDetail
          key={`${recordId}:${refreshVersion}`}
          transitions={detail.view.history.transitions.map((entry) => ({
            ...entry,
            actorId: detail.actors[entry.actorId] ?? entry.actorId,
          }))}
          state={detail.view.state}
          effects={detail.view.history.effectRuns.map((run) => ({
            ...run,
            effect: labels.effect(run.effect),
          }))}
          labels={{
            processDiagram: t('workflows.processDiagram'),
            history: t('workflows.history'),
            historyHint: t('workflows.historyHint'),
            step: t('workflows.step'),
            transition: t('workflows.transition'),
            from: t('workflows.from'),
            to: t('workflows.to'),
            actor: t('workflows.actor'),
            time: t('workflows.time'),
            noHistory: t('workflows.noHistory'),
            effects: t('workflows.effects'),
            effect: t('workflows.effect'),
            state: t('workflows.state'),
            attempts: t('workflows.attempts'),
            error: t('workflows.error'),
            noEffects: t('workflows.noEffects'),
            executionParameters: t('workflows.executionParameters'),
            snapshotHint: t('workflows.snapshotHint'),
            showStep: (step) => t('workflows.showStep', { step }),
          }}
          stateLabel={(name) => labels.state(name)}
          transitionLabel={(name) => labels.transition(name)}
          dateLabel={(at) => workflowDate(at, i18n.language)}
          effectStatusLabel={(status) =>
            t(`workflows.runStates.${status}`, { defaultValue: status })
          }
          parameters={
            detail.view.parameterValues ? (
              <dl className='grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm'>
                <dt className='text-muted-foreground'>
                  {t('workflows.approvalCategories')}
                </dt>
                <dd>
                  {(detail.view.parameterValues.approvalCategories ?? [])
                    .map((category) => t(`devices.categories.${category}`))
                    .join(', ')}
                </dd>
                <dt className='text-muted-foreground'>
                  {t('workflows.deviceLimit')}
                </dt>
                <dd>{detail.view.parameterValues.deviceLimit}</dd>
              </dl>
            ) : undefined
          }
          renderDiagram={({ current, history }) => (
            <LifecycleDiagram
              description={detail.description}
              ariaLabel={t('workflows.processDiagram')}
              presentation='process'
              currentState={current}
              history={history}
              stateLabel={(state) => labels.state(state.name)}
              transitionLabel={(transition) =>
                labels.transition(transition.name)
              }
            />
          )}
        />
      )}
    </WorkflowDetailPage>
  );
}
