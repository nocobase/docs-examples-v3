import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '@nocobase/i18n/client';
import { useNavigationGuard } from '@nocobase/app-client';
import { RouteDialog } from '#components/route-dialog';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { useRouteOverlay } from '#components/use-route-overlay';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '#components/ui/alert-dialog';
function FinishPreview({ onFinish }: { onFinish: () => void }) {
  const { t } = useTranslation();
  const { close } = useRouteOverlay();
  return (
    <Button
      onClick={() => {
        onFinish();
        void close();
      }}
    >
      {t('demo.finishPreview')}
    </Button>
  );
}
export default function NewProjectDraft() {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [preview, setPreview] = useState(false);
  const dirtyRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingDecisionRef = useRef<{
    promise: Promise<boolean>;
    resolve: (allowed: boolean) => void;
  } | null>(null);
  const canLeave = useCallback((): boolean | Promise<boolean> => {
    if (!dirtyRef.current) return true;
    // Closing the overlay and navigating can ask before either has an answer.
    if (!pendingDecisionRef.current) {
      let resolve!: (allowed: boolean) => void;
      const promise = new Promise<boolean>((done) => {
        resolve = done;
      });
      pendingDecisionRef.current = { promise, resolve };
      setConfirmOpen(true);
    }
    return pendingDecisionRef.current.promise;
  }, []);
  const decide = (allowed: boolean) => {
    setConfirmOpen(false);
    if (allowed) dirtyRef.current = false;
    pendingDecisionRef.current?.resolve(allowed);
    pendingDecisionRef.current = null;
  };
  useEffect(() => () => pendingDecisionRef.current?.resolve(false), []);
  useNavigationGuard(canLeave);
  useEffect(() => {
    const guard = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, []);
  return (
    <RouteDialog
      title={t('demo.newDraft')}
      beforeClose={canLeave}
      footer={
        preview ? (
          <FinishPreview
            onFinish={() => {
              dirtyRef.current = false;
            }}
          />
        ) : (
          <Button type='submit' form='draft-form' disabled={!name.trim()}>
            {t('demo.preview')}
          </Button>
        )
      }
    >
      <p className='mb-4 text-sm text-muted-foreground'>
        {t('demo.draftOnly')}
      </p>
      {preview ? (
        <p role='status'>{t('demo.draftPreview', { name })}</p>
      ) : (
        <form
          id='draft-form'
          className='grid gap-2'
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) setPreview(true);
          }}
        >
          <Label htmlFor='draft-name'>{t('demo.projectName')}</Label>
          <Input
            id='draft-name'
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              dirtyRef.current = Boolean(event.target.value);
            }}
          />
        </form>
      )}
      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) decide(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('demo.discard')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('demo.discardDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => decide(false)}>
              {t('demo.keepEditing')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => decide(true)}>
              {t('demo.discardAction')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RouteDialog>
  );
}
