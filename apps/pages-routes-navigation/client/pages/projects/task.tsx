import { useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { useRouteOverlay } from '#components/use-route-overlay';
import { projects } from './data.js';
function CloseTask() {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <Button onClick={() => void close()}>{t('demo.backToProject')}</Button>
  );
}
export default function ProjectTask() {
  const { projectId, taskId } = useParams();
  const { t } = useTranslation();
  const task = projects
    .find((project) => project.id === projectId)
    ?.tasks.find((item) => item.id === taskId);
  return (
    <RouteDialog
      title={task?.name ?? t('demo.notFound')}
      footer={<CloseTask />}
    >
      <p>
        {task ? t('demo.taskPath', { projectId, taskId }) : t('demo.notFound')}
      </p>
    </RouteDialog>
  );
}
