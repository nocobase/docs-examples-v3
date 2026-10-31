import { renderWithApp } from '@nocobase/app-testing/client';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import ReviewPage from '../../client/pages/ui-components/review.js';
import { CatalogApprovalProvider } from '../../client/pages/ui-components/approval-provider.js';
import enUS from '../../client/locales/en-US.js';
import metadata from '../../package.json' with { type: 'json' };
it('maps fixture identities through the provider and validates before running an action', async () => {
  await renderWithApp(
    <CatalogApprovalProvider>
      <ReviewPage />
    </CatalogApprovalProvider>,
    {
      namespace: metadata.name,
      namespaces: { [metadata.name]: enUS },
    },
  );
  expect(screen.getAllByText('Avery Chen').length).toBeGreaterThan(0);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Add review note' }));
  const buttons = screen.getAllByRole('button', { name: 'Add review note' });
  await user.click(buttons[0]);
  expect(screen.getByText('Enter a value.')).toBeVisible();
  expect(screen.getByRole('textbox', { name: /Review note/ })).toHaveAttribute(
    'aria-invalid',
    'true',
  );
});
