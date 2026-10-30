import { useNavigationGuard } from '@nocobase/app-client';
import { useTranslation } from '@nocobase/i18n/client';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { ConfirmAction } from '../settings/shared.js';
/** The same decision covers overlay close, sidebar links, browser history and refresh. */
export function useCustomerLeave(
  dirty: boolean,
  busy: boolean,
  onDiscard?: () => void,
  copy?: { title: string; description: string; confirmLabel: string },
) {
  const { t } = useTranslation();
  const location = useLocation();
  const allowedRef = useRef(false);
  useEffect(() => {
    allowedRef.current = false;
  }, [location.key]);
  const pendingRef = useRef<
    { promise: Promise<boolean>; resolve: (value: boolean) => void } | undefined
  >(undefined);
  const [open, setOpen] = useState(false);
  const guard = () => {
    if (allowedRef.current) return true;
    if (busy) return false;
    if (!dirty) return true;
    if (pendingRef.current) return pendingRef.current.promise;
    let resolve!: (value: boolean) => void;
    const promise = new Promise<boolean>((done) => {
      resolve = done;
    });
    pendingRef.current = { promise, resolve };
    setOpen(true);
    return promise;
  };
  useNavigationGuard(guard);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const decide = (value: boolean) => {
    if (value) onDiscard?.();
    allowedRef.current = value;
    pendingRef.current?.resolve(value);
    pendingRef.current = undefined;
    setOpen(false);
  };
  return {
    guard,
    reset: () => {
      allowedRef.current = false;
    },
    allow: () => {
      allowedRef.current = true;
    },
    dialog: (
      <ConfirmAction
        open={open}
        title={copy?.title ?? t('settings.discardTitle')}
        description={copy?.description ?? t('settings.discardHint')}
        confirmLabel={copy?.confirmLabel}
        busy={false}
        onCancel={() => decide(false)}
        onConfirm={() => decide(true)}
      />
    ),
  };
}
