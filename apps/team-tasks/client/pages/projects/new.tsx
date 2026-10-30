import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useOutletContext } from 'react-router';
import {
  ApiClientError,
  useApiClient,
  useSubmission,
  useToaster,
  useNavigationGuard,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { RouteDialog } from '#components/route-dialog';
import { useRouteOverlay } from '#components/use-route-overlay';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Label } from '#components/ui/label';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Spinner } from '#components/ui/spinner';
import type { Project, ProjectContext } from './types.js';

function Cancel({ busy }: { busy: boolean }) {
  const { close } = useRouteOverlay();
  const { t } = useTranslation();
  return (
    <Button variant='outline' disabled={busy} onClick={() => void close()}>
      {t('projects.cancel')}
    </Button>
  );
}
export default function NewProjectPage() {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const navigate = useNavigate();
  const location = useLocation();
  const { reload } = useOutletContext<ProjectContext>();
  const { session } = useAuthentication();
  const submission = useSubmission({
    scope: `${session?.user.id}:projects:new`,
  });
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [error, setError] = useState<unknown>();
  const guardRef = useRef(false);
  const busy = submission.submitting;
  const composingRef = useRef(false);
  useNavigationGuard(() => !guardRef.current);
  useEffect(() => {
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const handler = (event: BeforeUnloadEvent) => {
      if (guardRef.current) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('beforeunload', handler);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (trigger?.isConnected && trigger !== document.body)
            trigger.focus();
          else document.getElementById('project-search')?.focus();
        }),
      );
    };
  }, []);
  const save = async () => {
    if (guardRef.current || composingRef.current) return;
    setSubmitted(true);
    const invalid = name.trim().length < 1 || name.trim().length > 120;
    setFieldError(invalid);
    if (invalid) {
      document.getElementById('project-name')?.focus();
      return;
    }
    guardRef.current = true;
    setError(undefined);
    try {
      const saved = await submission.run(
        { name: name.trim() },
        (key, signal, snapshot) =>
          api.request<{ data: Project }>({
            path: 'projects',
            method: 'POST',
            json: snapshot,
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      if (!saved) return;
      reload();
      toaster.show({
        type: 'success',
        title: t('projects.created', { name: saved.data.name }),
      });
      guardRef.current = false;
      await navigate(
        { pathname: '..', search: location.search },
        { replace: true, relative: 'route' },
      );
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.status === 400) {
        setFieldError(true);
        document.getElementById('project-name')?.focus();
      } else setError(failure);
    } finally {
      guardRef.current = false;
    }
  };
  const denied =
    error instanceof ApiClientError && [401, 403].includes(error.status);
  const signedOut = error instanceof ApiClientError && error.status === 401;
  return (
    <RouteDialog
      title={t('projects.new')}
      className='sm:max-w-md'
      beforeClose={() => !guardRef.current}
      footer={
        <>
          <Cancel busy={busy} />
          <Button type='submit' form='project-form' disabled={busy || denied}>
            {busy ? <Spinner /> : null}
            {t(
              busy
                ? 'projects.saving'
                : submission.pending
                  ? 'projects.retry'
                  : 'projects.create',
            )}
          </Button>
        </>
      }
    >
      <form
        id='project-form'
        className='flex flex-col gap-4'
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {error ? (
          <Alert variant='destructive'>
            <AlertDescription>
              {t(
                signedOut
                  ? 'projects.signedOut'
                  : denied
                    ? 'projects.denied'
                    : 'projects.saveError',
              )}
              {signedOut ? (
                <Link to='/login'>{t('projects.signIn')}</Link>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        <div className='flex flex-col gap-2'>
          <Label htmlFor='project-name'>{t('projects.name')} *</Label>
          <Input
            id='project-name'
            autoFocus
            value={name}
            maxLength={120}
            readOnly={busy || submission.pending}
            aria-required='true'
            aria-invalid={fieldError}
            aria-describedby={fieldError ? 'project-name-error' : undefined}
            onCompositionStart={() => {
              composingRef.current = true;
            }}
            onCompositionEnd={() => {
              composingRef.current = false;
            }}
            onChange={(event) => {
              setName(event.target.value);
              if (submitted)
                setFieldError(
                  !event.target.value.trim() ||
                    event.target.value.trim().length > 120,
                );
            }}
          />
          {fieldError ? (
            <p
              id='project-name-error'
              role='alert'
              className='text-sm text-destructive'
            >
              {t('projects.nameInvalid')}
            </p>
          ) : null}
        </div>
      </form>
    </RouteDialog>
  );
}
