import { useTranslation } from '@nocobase/i18n/client';
import { projects } from '../projects/data.js';
export default function Owners() {
  const { t } = useTranslation();
  return (
    <section>
      <h2 className='mb-3 font-semibold'>{t('demo.owners')}</h2>
      <ul className='grid gap-2'>
        {projects.map((p) => (
          <li key={p.id}>
            {p.owner}: {p.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
