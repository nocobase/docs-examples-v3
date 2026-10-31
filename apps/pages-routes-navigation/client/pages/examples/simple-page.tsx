import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
export function SimplePage({
  titleKey,
  descriptionKey,
}: {
  titleKey: string;
  descriptionKey: string;
}) {
  const { t } = useTranslation();
  return (
    <PageContainer>
      <PageHeader title={t(titleKey)} description={t(descriptionKey)} />
    </PageContainer>
  );
}
