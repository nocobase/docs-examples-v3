import { useState } from 'react';
import { useParams } from 'react-router';
import { useTranslation } from '@nocobase/i18n/client';
import { useToaster } from '@nocobase/app-client';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Checkbox } from '#components/ui/checkbox';
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from '#components/ui/field';
import { Alert, AlertDescription } from '#components/ui/alert';
import { useCatalogDemo } from './demo-context.js';
import { useEditorLeave } from './use-editor-leave.js';
export default function EditProductPage() {
  const { productId } = useParams();
  // A new record gets a new draft even if the route module is reused.
  return <ProductEditor key={productId} productId={productId ?? ''} />;
}
function ProductEditor({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const { products, rename } = useCatalogDemo();
  const product = products.find((p) => p.id === productId);
  const [name, setName] = useState(product?.name ?? '');
  const [pending, setPending] = useState(false);
  const [fail, setFail] = useState(false);
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const leave = useEditorLeave(name !== product?.name, pending);
  return (
    <RouteDialog
      title={t('catalog.editTitle')}
      description={t('catalog.editDescription')}
      className='sm:max-w-md'
      beforeClose={leave.guard}
      footer={<EditorFooter pending={pending} disabled={!product} />}
    >
      {product ? (
        <EditorBody
          name={name}
          setName={(value) => {
            setName(value);
            leave.setDirty(value !== product.name);
          }}
          pending={pending}
          fail={fail}
          setFail={setFail}
          error={error}
          invalid={invalid}
          save={async () => {
            if (leave.isPending()) return false;
            if (!name.trim()) {
              setInvalid(true);
              return false;
            }
            leave.setPending(true);
            setPending(true);
            setError('');
            setInvalid(false);
            // Explicit UI fixture delay/failure; replace with the application's real write at integration time.
            await new Promise((resolve) => setTimeout(resolve, 700));
            leave.setPending(false);
            setPending(false);
            if (fail) {
              setError(t('catalog.saveFailed'));
              return false;
            }
            leave.setDirty(false);
            leave.allow();
            rename(product.id, name.trim());
            return true;
          }}
        />
      ) : (
        <Alert>
          <AlertDescription>{t('catalog.missing')}</AlertDescription>
        </Alert>
      )}
      {leave.confirmation}
    </RouteDialog>
  );
}
function EditorFooter({
  pending,
  disabled,
}: {
  pending: boolean;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  const { close, isClosing } = useRouteOverlay();
  return (
    <>
      <Button
        variant='outline'
        disabled={pending || isClosing}
        onClick={() => void close()}
      >
        {t('catalog.cancel')}
      </Button>
      <Button
        type='submit'
        form='product-edit'
        disabled={pending || isClosing || disabled}
      >
        {pending ? t('catalog.saving') : t('catalog.save')}
      </Button>
    </>
  );
}
function EditorBody({
  name,
  setName,
  pending,
  fail,
  setFail,
  error,
  invalid,
  save,
}: {
  name: string;
  setName: (s: string) => void;
  pending: boolean;
  fail: boolean;
  setFail: (b: boolean) => void;
  error: string;
  invalid: boolean;
  save: () => Promise<boolean>;
}) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  const toaster = useToaster();
  return (
    <form
      id='product-edit'
      className='flex flex-col gap-5'
      onSubmit={(e) => {
        e.preventDefault();
        void save().then((saved) => {
          if (saved) {
            toaster.show({ type: 'success', title: t('catalog.saved') });
            void close();
          }
        });
      }}
    >
      {error && (
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor='product-name'>{t('catalog.name')} *</FieldLabel>
        <Input
          id='product-name'
          value={name}
          disabled={pending}
          aria-invalid={invalid}
          onChange={(e) => setName(e.target.value)}
        />
        {invalid && <FieldError>{t('catalog.required')}</FieldError>}
      </Field>
      <Field>
        <FieldLabel>
          <Checkbox
            checked={fail}
            disabled={pending}
            onCheckedChange={(value) => setFail(value === true)}
          />
          {t('catalog.failSave')}
        </FieldLabel>
        <FieldDescription>{t('catalog.failureHint')}</FieldDescription>
      </Field>
    </form>
  );
}
