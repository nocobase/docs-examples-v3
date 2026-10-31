// Language changes formatting; currency and business time zone stay explicit.
export function productFormatters(locale: string) {
  return {
    number: new Intl.NumberFormat(locale),
    money: new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
    }),
    date: new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }),
  };
}
