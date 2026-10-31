import { useState } from 'react';
import { useTranslation } from '@nocobase/i18n/client';
import { PageContainer } from '#components/page-container';
import { PageHeader } from '#components/page-header';
import { Button } from '#components/ui/button';
import { Input } from '#components/ui/input';
import { Field, FieldLabel, FieldError } from '#components/ui/field';
import { Alert, AlertDescription } from '#components/ui/alert';
import { Card, CardHeader, CardTitle, CardContent } from '#components/ui/card';
import {
  ApprovalProgress,
  ApprovalTimeline,
  ApprovalActionBar,
  type ApprovalBarAction,
  type ApprovalStep,
  type ApprovalTimelineLine,
} from '#extensions/nocobase-approval-ui/index';
function noteText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
export default function ReviewPage() {
  const { t } = useTranslation();
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [rejectNext, setRejectNext] = useState(false);
  const steps: ApprovalStep[] = [
    {
      key: 'submit',
      title: t('catalog.review.submitted'),
      state: 'done',
      at: '2026-01-12T09:00:00Z',
      tasks: [{ key: 'a', personId: 'person-1', badges: [] }],
    },
    {
      key: 'review',
      title: t('catalog.review.contentReview'),
      state: 'current',
      tasks: [
        {
          key: 'b',
          personId: 'person-2',
          badges: [
            { label: t('catalog.review.waiting'), variant: 'secondary' },
          ],
        },
      ],
    },
  ];
  const lines: ApprovalTimelineLine[] = [
    {
      key: 'created',
      at: '2026-01-12T09:00:00Z',
      actorId: 'person-1',
      kind: 'event',
      title: t('catalog.review.submitted'),
      comment: t('catalog.review.initialNote'),
    },
  ];
  if (comment)
    lines.push({
      key: 'note',
      at: '2026-01-12T09:30:00Z',
      actorId: 'person-2',
      kind: 'event',
      title: t('catalog.review.noteAdded'),
      comment,
    });
  const actions: ApprovalBarAction[] = [
    {
      key: 'note',
      label: t('catalog.review.addNote'),
      primary: true,
      form: {
        initialValues: { note: '' },
        validate: (values) => (noteText(values.note).trim() ? [] : ['note']),
        render: ({ values, setValues, invalid, busy }) => (
          <Field data-invalid={invalid.includes('note')}>
            <FieldLabel htmlFor='review-note'>
              {t('catalog.review.note')} *
            </FieldLabel>
            <Input
              id='review-note'
              disabled={busy}
              value={noteText(values.note)}
              onChange={(e) => setValues({ note: e.target.value })}
              aria-invalid={invalid.includes('note')}
            />
            {invalid.includes('note') && (
              <FieldError>{t('catalog.required')}</FieldError>
            )}
          </Field>
        ),
      },
      run: async (values) => {
        setError('');
        await new Promise((resolve) => setTimeout(resolve, 700));
        if (rejectNext) {
          setRejectNext(false);
          setError(t('catalog.review.refused'));
          return false;
        }
        setComment(noteText(values.note).trim());
      },
    },
  ];
  return (
    <PageContainer>
      <PageHeader
        title={t('catalog.review.title')}
        description={t('catalog.review.description')}
        actions={
          <Button
            variant='outline'
            onClick={() => {
              setComment('');
              setError('');
              setRejectNext(false);
            }}
          >
            {t('catalog.review.reset')}
          </Button>
        }
      />
      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>{t('catalog.review.progress')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalProgress steps={steps} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('catalog.review.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ApprovalTimeline lines={lines} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('catalog.review.actions')}</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-4'>
          {error && (
            <Alert variant='destructive'>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <ApprovalActionBar actions={actions} />
          <div>
            <Button
              variant='ghost'
              disabled={rejectNext}
              onClick={() => setRejectNext(true)}
            >
              {rejectNext
                ? t('catalog.review.failureReady')
                : t('catalog.review.failNext')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
