import type { ReactNode } from 'react';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';

interface ProductPageFrameProps {
  title: ReactNode;
  description: ReactNode;
  actions: ReactNode;
  filterLabel: string;
  filters: ReactNode;
  children: ReactNode;
}

export function ProductPageFrame({
  title,
  description,
  actions,
  filterLabel,
  filters,
  children,
}: ProductPageFrameProps) {
  return (
    <PageContainer>
      <PageHeader title={title} description={description} actions={actions} />
      <div className='grid min-w-0 gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]'>
        <aside aria-label={filterLabel} className='flex min-w-0 flex-col gap-4'>
          {filters}
        </aside>
        <div className='min-w-0'>{children}</div>
      </div>
    </PageContainer>
  );
}
