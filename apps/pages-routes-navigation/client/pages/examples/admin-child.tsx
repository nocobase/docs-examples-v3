import { useTranslation } from '@nocobase/i18n/client';
export default function AdminChild() {
  const { t } = useTranslation();
  return <p>{t('demo.adminChildDescription')}</p>;
}
