import { useMemo } from 'react';
import { Link, Outlet, useLocation, useSearchParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { useCan } from '@nocobase/app-plugin-authorization/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { DataTable } from '#components/data-table';
import { RecordLink } from '#components/record-link';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { projects } from './data.js';
export default function ProjectsPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const [search, setSearch] = useSearchParams();
  const query = search.get('q') ?? '';
  const { can: canCreate } = useCan({
    resource: { type: 'page', id: 'project-drafts' },
    action: 'access',
  });
  const rows = projects.filter((project) =>
    project.name.toLowerCase().includes(query.toLowerCase()),
  );
  const context = useMemo(
    () => ({ listSearch: location.search }),
    [location.search],
  );
  return (
    <PageContainer>
      <PageHeader
        title={t('demo.projects')}
        description={t('demo.fixtures')}
        actions={
          canCreate ? (
            <Button
              nativeButton={false}
              render={
                <Link to={{ pathname: 'new', search: location.search }} />
              }
            >
              {t('demo.newDraft')}
            </Button>
          ) : null
        }
      />
      <div className='grid max-w-sm gap-2'>
        <Label htmlFor='project-search'>{t('demo.search')}</Label>
        <Input
          id='project-search'
          value={query}
          onChange={(event) => {
            const next = new URLSearchParams(search);
            if (event.target.value) next.set('q', event.target.value);
            else next.delete('q');
            setSearch(next, { replace: true });
          }}
        />
      </div>
      <DataTable
        data={rows}
        pagination={false}
        emptyMessage={t('demo.noMatches')}
        columns={[
          {
            accessorKey: 'name',
            header: t('demo.projectName'),
            cell: ({ row }) => (
              <RecordLink
                to={{ pathname: row.original.id, search: location.search }}
              >
                {row.original.name}
              </RecordLink>
            ),
          },
          { accessorKey: 'owner', header: t('demo.owner') },
        ]}
      />
      <Outlet context={context} />
    </PageContainer>
  );
}
