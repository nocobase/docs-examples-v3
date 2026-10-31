import { useLocation, useParams } from 'react-router';
import { usePageBreadcrumb } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { RouteChildPage } from '#components/route-child-page';
import { projects } from './data.js';
export function ProjectPage() {
  const { t } = useTranslation();
  const { projectId } = useParams();
  const location = useLocation();
  const project = projects.find((item) => item.id === projectId);
  usePageBreadcrumb(
    project
      ? [
          {
            label: t('demo.projects'),
            to: { pathname: '/projects', search: location.search },
          },
          { label: project.name },
        ]
      : undefined,
  );
  return (
    <PageContainer>
      <PageHeader
        title={project?.name ?? t('demo.notFound')}
        description={t('demo.workspaceDescription')}
      />
      {project ? (
        <p>
          {t('demo.owner')}: {project.owner}
        </p>
      ) : (
        <p role='alert'>{t('demo.notFound')}</p>
      )}
    </PageContainer>
  );
}
export default function ProjectWorkspace() {
  return (
    <RouteChildPage>
      <ProjectPage />
    </RouteChildPage>
  );
}
