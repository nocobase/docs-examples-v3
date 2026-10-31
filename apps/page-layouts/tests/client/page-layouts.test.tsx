import { renderWithApp } from '@nocobase/app-testing/client';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';
import ProductLayoutsPage from '../../client/pages/layouts/index.js';
import enUS from '../../client/locales/en-US.js';
import metadata from '../../package.json' with { type: 'json' };

it('filters fixtures, clears no-match results and changes the heading without duplicating containers', async () => {
  await renderWithApp(<ProductLayoutsPage />, {
    namespace: metadata.name,
    namespaces: { [metadata.name]: enUS },
  });
  const user = userEvent.setup();
  await user.type(
    screen.getByRole('textbox', { name: 'Search products' }),
    'not-a-product',
  );
  expect(screen.getByText('No matching products.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Clear search' }));
  expect(
    screen.getByRole('link', { name: 'Arc desk lamp 01', exact: true }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Long heading' }));
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'regional distribution',
  );
});
