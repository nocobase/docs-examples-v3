import { useNavigationGuard } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { useEffect, useRef, useState } from 'react';
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
export function useEditorLeave(dirty: boolean, pending: boolean) {
  const { t } = useTranslation();
  // Event handlers update these synchronously before close() can run.
  const flagsRef = useRef({ dirty, pending });
  const requestRef = useRef<
    { promise: Promise<boolean>; resolve: (allow: boolean) => void } | undefined
  >(undefined);
  const [open, setOpen] = useState(false);
  const allowedRef = useRef(false);
  function guard() {
    if (allowedRef.current) return true;
    if (flagsRef.current.pending) return false;
    if (!flagsRef.current.dirty) return true;
    if (!requestRef.current) {
      let resolve!: (allow: boolean) => void;
      const promise = new Promise<boolean>((done) => {
        resolve = done;
      });
      requestRef.current = { promise, resolve };
      setOpen(true);
    }
    return requestRef.current.promise;
  }
  useNavigationGuard(guard);
  useEffect(() => {
    if (!dirty && !pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);
  useEffect(
    () => () => {
      requestRef.current?.resolve(false);
    },
    [],
  );
  function answer(allow: boolean) {
    if (allow) {
      flagsRef.current.dirty = false;
      allowedRef.current = true;
    }
    requestRef.current?.resolve(allow);
    requestRef.current = undefined;
    setOpen(false);
  }
  return {
    guard,
    setDirty: (value: boolean) => {
      flagsRef.current.dirty = value;
    },
    setPending: (value: boolean) => {
      flagsRef.current.pending = value;
    },
    isPending: () => flagsRef.current.pending,
    allow: () => {
      allowedRef.current = true;
    },
    confirmation: (
      <AlertDialog
        open={open}
        onOpenChange={(value) => {
          if (!value) answer(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('catalog.discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('catalog.discardDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => answer(false)}>
              {t('catalog.keepEditing')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => answer(true)}>
              {t('catalog.discard')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}
