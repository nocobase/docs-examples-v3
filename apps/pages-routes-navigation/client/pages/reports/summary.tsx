import { useTranslation } from '@nocobase/i18n/client';
import { projects } from '../projects/data.js';
export default function Summary() {
  const { t } = useTranslation();
  return <p>{t('demo.summaryCount', { count: projects.length })}</p>;
}
