import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import type { LifecycleDescription } from '@nocobase/lifecycle';
import { LifecycleDiagram } from '#components/lifecycle-diagram';
import { WorkflowDefinitionDetail } from '#extensions/nocobase-workflow-management/layout';
import { ApprovalRulesForm } from './parameters.js';
import { DataState, WorkflowDetailPage } from './shared.js';
import { useWorkflowData, useWorkflowLabels } from './hooks.js';
import type { WorkflowSummary } from './definitions.js';

export default function DefinitionPage(): ReactElement {
  const { workflowId = '' } = useParams();
  const { t } = useTranslation();
  const labels = useWorkflowLabels();
  const request = useWorkflowData<{
    data: { workflow: WorkflowSummary; description: LifecycleDescription };
  }>(`workflows/definitions/${encodeURIComponent(workflowId)}`);
  const definition = request.data?.data;
  return (
    <WorkflowDetailPage
      title={
        definition
          ? labels.title(definition.workflow.name)
          : t('workflows.definitions')
      }
      titleSuffix={
        definition ? (
          <Link
            to={`/settings/workflows/executions?workflowId=${encodeURIComponent(workflowId)}`}
            className='text-sm font-normal text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
          >
            {t('workflows.executionCountLink', {
              count: definition.workflow.executionCount,
            })}
          </Link>
        ) : undefined
      }
      description={definition ? t('workflows.summary') : undefined}
      listTitle={t('workflows.definitions')}
      closeTo='/settings/workflows/definitions'
    >
      <DataState {...request} retry={request.reload} />
      {definition && (
        <WorkflowDefinitionDetail
          diagramTitle={t('workflows.processDiagram')}
          parametersTitle={t('workflows.parameterSettings')}
          diagram={
            <LifecycleDiagram
              description={definition.description}
              ariaLabel={t('workflows.processDiagram')}
              presentation='process'
              stateLabel={(state) => labels.state(state.name)}
              transitionLabel={(transition) =>
                labels.transition(transition.name)
              }
            />
          }
          parameters={<ApprovalRulesForm workflowId={workflowId} />}
        />
      )}
    </WorkflowDetailPage>
  );
}
