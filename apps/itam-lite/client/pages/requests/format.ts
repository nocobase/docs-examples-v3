export function formatDate(value: string, locale: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? '—'
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(date);
}

/** A calendar date (`YYYY-MM-DD`) as written, with no time and no shift into the viewer's time zone. */
export function formatDay(value: string | null, locale: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf())
    ? '—'
    : new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(date);
}
