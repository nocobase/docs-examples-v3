import { useService } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from '#components/ui/select';
import { productsServiceToken } from '../../services/tokens.js';
import type { Product, DemoMode } from '../../services/products.js';

export function ProductEditor({ product }: { product: Product }) {
  const { t } = useTranslation();
  const products = useService(productsServiceToken);
  const [name, setName] = useState(product.name);
  const [mode, setMode] = useState<DemoMode>('normal');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [invalid, setInvalid] = useState(false);
  const activeRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeRef.current?.abort();
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (activeRef.current) return;
    if (!name.trim() || name.trim().length > 80) {
      setInvalid(true);
      inputRef.current?.focus();
      return;
    }
    setInvalid(false);
    setFeedback('');
    setPending(true);
    const controller = new AbortController();
    activeRef.current = controller;
    try {
      const saved = await products.rename(product.id, name.trim(), {
        signal: controller.signal,
        mode,
      });
      if (mountedRef.current) {
        setName(saved.name);
        setFeedback('saved');
      }
    } catch {
      if (mountedRef.current)
        setFeedback(controller.signal.aborted ? 'cancelled' : 'failed');
    } finally {
      activeRef.current = null;
      if (mountedRef.current) setPending(false);
    }
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className='flex flex-col gap-4'
    >
      <div className='flex flex-col gap-2'>
        <Label htmlFor='product-name'>{t('serviceProducts.name')}</Label>
        <Input
          ref={inputRef}
          id='product-name'
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={pending}
          aria-invalid={invalid}
          aria-describedby={invalid ? 'name-error' : undefined}
        />
        {invalid && (
          <p id='name-error' role='alert' className='text-sm text-destructive'>
            {t('serviceProducts.required')}
          </p>
        )}
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='response-mode'>{t('serviceProducts.mode')}</Label>
        <Select
          value={mode}
          onValueChange={(value) => {
            if (value) setMode(value);
          }}
          disabled={pending}
          items={['normal', 'slow', 'fail'].map((value) => ({
            value,
            label: t(`serviceProducts.${value}`),
          }))}
        >
          <SelectTrigger id='response-mode'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {['normal', 'slow', 'fail'].map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`serviceProducts.${value}`)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {mode === 'slow' && (
        <p className='text-sm text-muted-foreground'>
          {t('serviceProducts.slowHint')}
        </p>
      )}
      <div className='flex flex-wrap gap-2'>
        <Button type='submit' disabled={pending}>
          {t(pending ? 'serviceProducts.saving' : 'serviceProducts.save')}
        </Button>
        {pending && (
          <Button
            variant='outline'
            type='button'
            onClick={() => activeRef.current?.abort()}
          >
            {t('serviceProducts.cancel')}
          </Button>
        )}
      </div>
      {feedback && (
        <p
          role={feedback === 'failed' ? 'alert' : 'status'}
          className='text-sm'
        >
          {t(`serviceProducts.${feedback}`)}
        </p>
      )}
    </form>
  );
}
