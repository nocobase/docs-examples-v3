import { renderWithApp } from '@nocobase/app-testing/client';
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import HomePage from '../../client/pages/home/index.js';
import enUS from '../../client/locales/en-US.js';
import zhCN from '../../client/locales/zh-CN.js';

it.each([
  ['en-US', enUS],
  ['zh-CN', zhCN],
] as const)(
  'opens the routing examples in %s and explains fixture behavior',
  async (locale, messages) => {
    await renderWithApp(<HomePage />, {
      locale,
      namespace: 'pages-routes-navigation',
      namespaces: { 'pages-routes-navigation': messages },
    });
    expect(
      screen.getByRole('heading', { name: messages.demo.title }),
    ).toBeVisible();
    expect(screen.getByText(messages.demo.fixtures)).toBeVisible();
    expect(
      screen.getByRole('button', { name: messages.demo.projects }),
    ).toHaveAttribute('href', '/projects');
  },
);
