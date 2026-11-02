import { useApiClient, useSubmission } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { useState, type FormEvent } from 'react';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';

export function ProductForm({ onCreated }: { onCreated: () => void }) {
  const api = useApiClient();
  const { t } = useTranslation();
  const submission = useSubmission({ scope: 'products:create' });
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(false);
    setSaved(false);
    try {
      const result = await submission.run(
        { name: name.trim(), priceCents: Number(price) },
        (idempotencyKey) =>
          api.request({
            path: 'products',
            method: 'POST',
            headers: { 'Idempotency-Key': idempotencyKey },
            json: { name: name.trim(), priceCents: Number(price) },
          }),
      );
      if (!result) return;
      setName('');
      setPrice('');
      setSaved(true);
      onCreated();
    } catch {
      setError(true);
    }
  }
  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      className='grid gap-4 rounded-lg border bg-card p-5'
    >
      <h2 className='font-semibold'>{t('products.save')}</h2>
      <div className='grid gap-2'>
        <Label htmlFor='product-name'>{t('products.name')}</Label>
        <Input
          id='product-name'
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submission.submitting}
        />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='product-price'>{t('products.price')}</Label>
        <Input
          id='product-price'
          type='number'
          required
          min={0}
          max={100000000}
          step={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          disabled={submission.submitting}
        />
      </div>
      {error && (
        <p role='alert' className='text-sm text-destructive'>
          {t('products.failed')}
        </p>
      )}
      {saved && (
        <p role='status' className='text-sm'>
          {t('products.saved')}
        </p>
      )}
      <Button type='submit' disabled={submission.submitting}>
        {t(submission.submitting ? 'products.saving' : 'products.save')}
      </Button>
    </form>
  );
}
