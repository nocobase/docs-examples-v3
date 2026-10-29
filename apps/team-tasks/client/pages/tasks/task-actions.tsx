import { useTasks, focusTaskSearch } from './context.js';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ApiClientError,
  useApiClient,
  useToaster,
  useNavigationGuard,
  useSubmission,
} from '@nocobase/app-client';
import { useAuthentication } from '@nocobase/app-plugin-authentication/client';
import { useTranslation } from '@nocobase/i18n/client';
import { MoreHorizontal, LoaderCircle } from 'lucide-react';
import { Button } from '#components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '#components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '#components/ui/alert-dialog';
import { TaskError } from './shared.js';
import type { Task, TaskStatus } from './types.js';

export function TaskActions({
  task,
  detail = false,
}: {
  task: Task;
  detail?: boolean;
}) {
  const { t } = useTranslation();
  const api = useApiClient();
  const toaster = useToaster();
  const navigate = useNavigate();
  const parent = useTasks();
  const { session } = useAuthentication();
  const submission = useSubmission({
    scope: `${session?.user.id}:tasks:${task.id}:actions:${detail ? 'detail' : 'row'}`,
  });
  const errorToastId = `tasks:${task.id}:progress-error`;
  const retryRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const progressSnapshotRef = useRef<
    { status: TaskStatus; expectedUpdatedAt: string } | undefined
  >(undefined);
  const pendingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const [deleting, setDeleting] = useState<Task>();
  const [deleteReady, setDeleteReady] = useState(false);
  useNavigationGuard(() => !pendingRef.current && !submission.pending);
  const begin = () => {
    if (pendingRef.current) return false;
    pendingRef.current = true;
    setBusy(true);
    toaster.close(errorToastId);
    setError(undefined);
    return true;
  };
  const finish = () => {
    pendingRef.current = false;
    setBusy(false);
  };
  const fail = (next: unknown) => {
    if (next instanceof ApiClientError && next.status === 404) {
      parent.removed(task.id);
      setDeleting(undefined);
      finish();
      toaster.show({
        type: 'error',
        title: t('tasks.namedMissing', { title: task.title }),
      });
      if (detail) void navigate(`/tasks${parent.search}`, { replace: true });
      focusTaskSearch();
    } else setError(next);
  };
  const progress = async (status: TaskStatus) => {
    if (!begin()) return;
    retryRef.current = () => progress(status);
    try {
      if (!submission.pending) {
        const { data: current } = await api.request<{ data: Task }>({
          path: `tasks/${task.id}/progress`,
        });
        progressSnapshotRef.current = {
          status,
          expectedUpdatedAt: current.updatedAt,
        };
      }
      if (!progressSnapshotRef.current) return;
      const saved = await submission.run(
        progressSnapshotRef.current,
        (key, signal, snapshot) =>
          api.request<{ data: Task }>({
            path: `tasks/${task.id}/status`,
            method: 'PATCH',
            json: snapshot,
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      if (!saved) return;
      retryRef.current = undefined;
      const { data: updated } = saved;
      parent.changed(updated);
      toaster.show({
        type: 'success',
        title: t('tasks.progressSaved', { title: updated.title }),
      });
    } catch (next) {
      if (!(next instanceof ApiClientError && next.status === 404)) {
        toaster.show({
          type: 'error',
          id: errorToastId,
          title: t('tasks.progressFailed', { title: task.title }),
        });
      }
      fail(next);
    } finally {
      finish();
    }
  };
  const prepareDelete = async () => {
    if (!begin()) return;
    setDeleting(task);
    setDeleteReady(false);
    try {
      const { data } = await api.request<{ data: Task }>({
        path: `tasks/${task.id}/delete`,
      });
      setDeleting(data);
      setDeleteReady(true);
    } catch (next) {
      fail(next);
    } finally {
      finish();
    }
  };
  const remove = async () => {
    if (!deleting || !deleteReady || !begin()) return;
    try {
      retryRef.current = remove;
      const saved = await submission.run(
        { expectedUpdatedAt: deleting.updatedAt },
        (key, signal, snapshot) =>
          api.request({
            path: `tasks/${task.id}?${new URLSearchParams(snapshot)}`,
            method: 'DELETE',
            headers: { 'Idempotency-Key': key },
            signal,
          }),
      );
      if (!saved) return;
      retryRef.current = undefined;
      parent.removed(task.id);
      setDeleting(undefined);
      finish();
      toaster.show({
        type: 'success',
        title: t('tasks.deleted', { title: deleting.title }),
      });
      if (detail) void navigate(`/tasks${parent.search}`, { replace: true });
      focusTaskSearch();
    } catch (next) {
      fail(next);
    } finally {
      finish();
    }
  };
  const any =
    task.permissions.edit ||
    task.permissions.progress ||
    task.permissions.delete;
  if (!any) return null;
  return (
    <div className='flex flex-wrap items-center justify-end gap-2'>
      {detail && task.permissions.edit && (
        <Button
          disabled={busy || submission.pending}
          onClick={() => void navigate(`edit${parent.search}`)}
        >
          {t('tasks.editAction')}
        </Button>
      )}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              disabled={busy || submission.pending}
              aria-label={t('tasks.actions', { title: task.title })}
            >
              {busy ? (
                <LoaderCircle className='animate-spin' />
              ) : (
                <MoreHorizontal />
              )}
            </Button>
          }
        />
        <DropdownMenuContent align='end' className='w-auto min-w-40'>
          {task.permissions.edit && !detail && (
            <DropdownMenuItem
              onClick={() =>
                void navigate(
                  detail
                    ? `edit${parent.search}`
                    : `/tasks/edit/${task.id}${parent.search}`,
                )
              }
            >
              {t('tasks.editAction')}
            </DropdownMenuItem>
          )}
          {task.permissions.progress && (
            <>
              {task.status === 'todo' && (
                <DropdownMenuItem onClick={() => void progress('inProgress')}>
                  {t('tasks.start')}
                </DropdownMenuItem>
              )}
              {task.status !== 'done' && (
                <DropdownMenuItem onClick={() => void progress('done')}>
                  {t('tasks.complete')}
                </DropdownMenuItem>
              )}
              {task.status !== 'todo' && (
                <DropdownMenuItem onClick={() => void progress('todo')}>
                  {t('tasks.reopen')}
                </DropdownMenuItem>
              )}
            </>
          )}
          {task.permissions.delete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => void prepareDelete()}
              >
                {t('tasks.delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {!deleting && (
        <TaskError
          error={error}
          retry={() => void retryRef.current?.()}
          title={task.title}
          reload={() => {
            toaster.close(errorToastId);
            setError(undefined);
            parent.reload();
          }}
        />
      )}
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !pendingRef.current && !submission.pending) {
            setDeleting(undefined);
            setError(undefined);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('tasks.deleteTitle', { title: deleting?.title })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('tasks.deleteHint')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <TaskError
            error={error}
            title={deleting?.title}
            reload={() => void prepareDelete()}
            retry={() =>
              submission.pending ? void remove() : void prepareDelete()
            }
          />
          <AlertDialogFooter>
            <Button
              variant='outline'
              disabled={busy || submission.pending}
              onClick={() => {
                setDeleting(undefined);
                setError(undefined);
              }}
            >
              {t('tasks.cancel')}
            </Button>
            <Button
              variant='destructive'
              disabled={
                busy ||
                !deleteReady ||
                (error instanceof ApiClientError && error.status === 409)
              }
              onClick={() => void remove()}
            >
              {busy && <LoaderCircle className='animate-spin' />}
              {busy ? t('tasks.deleting') : t('tasks.delete')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
