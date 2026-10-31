import { Link, Outlet, useOutletContext, useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDrawer } from '#components/route-drawer';
import { RecordLink } from '#components/record-link';
import { Button } from '#components/ui/button';
import { useRouteOverlay } from '#components/use-route-overlay';
import { projects } from './data.js';
function CloseButton() {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <Button variant='outline' onClick={() => void close()}>
      {t('demo.backToList')}
    </Button>
  );
}
export default function ProjectDetail() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const { listSearch } = useOutletContext<{ listSearch: string }>();
  const project = projects.find((item) => item.id === projectId);
  return (
    <RouteDrawer
      title={project?.name ?? t('demo.notFound')}
      footer={<CloseButton />}
    >
      {project ? (
        <div className='grid gap-4'>
          <p>
            {t('demo.owner')}: {project.owner}
          </p>
          <h2 className='font-semibold'>{t('demo.tasks')}</h2>
          {project.tasks.map((task) => (
            <RecordLink
              key={task.id}
              to={{ pathname: `tasks/${task.id}`, search: listSearch }}
            >
              {task.name}
            </RecordLink>
          ))}
          <Button
            variant='outline'
            nativeButton={false}
            render={
              <Link
                to={{
                  pathname: `/projects/workspace/${project.id}`,
                  search: listSearch,
                }}
              />
            }
          >
            {t('demo.workspace')}
          </Button>
          <Button
            variant='outline'
            nativeButton={false}
            render={
              <Link
                to={{
                  pathname: `/project-pages/${project.id}`,
                  search: listSearch,
                }}
              />
            }
          >
            {t('demo.projectPage')}
          </Button>
        </div>
      ) : (
        <p role='alert'>{t('demo.notFound')}</p>
      )}
      <Outlet />
    </RouteDrawer>
  );
}
