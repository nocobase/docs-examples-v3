/// <reference lib="dom" />
import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const baseURL = process.env.THEME_DEMO_URL;
if (!baseURL)
  throw new Error(
    'Set THEME_DEMO_URL to the running application URL, including its base path and trailing slash.',
  );
const url = new URL('products', baseURL).href;
const captures = path.resolve('storage/theme-review');
const mode = (page: Page, name: string) =>
  page.getByRole('button', { name, exact: true });
async function shot(page: Page, name: string) {
  await mkdir(captures, { recursive: true });
  await page.screenshot({
    path: path.join(captures, `${name}.png`),
    fullPage: false,
    animations: 'disabled',
  });
}
async function ready(page: Page) {
  await page.goto(url);
  await expect(
    page.getByRole('heading', { name: 'Product catalog' }),
  ).toBeVisible();
}

test.use({ viewport: { width: 1200, height: 760 }, colorScheme: 'light' });

test('all presets, modes, previews and responsive layouts', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await ready(page);
  const padding: number[] = [];
  for (const [label, preset] of [
    ['Compact', 'compact'],
    ['Spacious', 'default'],
    ['Brand', 'brand'],
  ]) {
    await mode(page, label).click();
    padding.push(
      await page
        .getByTestId('appearance-panel')
        .evaluate((el) => parseFloat(getComputedStyle(el).paddingTop)),
    );
    for (const color of ['Light', 'Dark']) {
      await mode(page, color).click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', preset);
      await expect(page.locator('html')).toHaveClass(color.toLowerCase());
      await shot(page, `${preset}-${color.toLowerCase()}`);
      if (preset === 'brand') {
        const contrast = await page.evaluate(() => {
          function rgb(color: string) {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 1;
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data]
              .slice(0, 3)
              .map((value) => {
                const c = value / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
          }
          const css = getComputedStyle(document.documentElement);
          return [
            ['primary', 'primary-foreground'],
            ['accent', 'accent-foreground'],
          ].map(([bg, fg]) => {
            const a = rgb(css.getPropertyValue(`--${bg}`));
            const b = rgb(css.getPropertyValue(`--${fg}`));
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          });
        });
        for (const ratio of contrast) expect(ratio).toBeGreaterThanOrEqual(4.5);
        console.log(color, 'brand contrast', contrast);
      }
      await page.setViewportSize({ width: 375, height: 812 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await expect(mode(page, 'Brand')).toBeVisible();
      await shot(page, `${preset}-${color.toLowerCase()}-mobile`);
      await page.setViewportSize({ width: 1200, height: 760 });
    }
  }
  expect(padding[0]).toBeLessThan(padding[1]);
  await page.getByRole('button', { name: 'Appearance', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('radio', { name: 'Brand', exact: true }),
  ).toBeChecked();
  await shot(page, 'appearance-preview');
  await page.getByRole('radio', { name: 'Compact', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Spacious' })).toBeChecked();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('button', { name: 'Appearance', exact: true }),
  ).toBeFocused();
  expect(errors).toEqual([]);
});

test('edit validation, keyboard focus, cancellation and memory-only save', async ({
  page,
}) => {
  await ready(page);
  await mode(page, 'Brand').click();
  for (const color of ['Light', 'Dark']) {
    await mode(page, color).click();
    await page.getByRole('link', { name: 'Arc desk lamp' }).click();
    const name = page.getByLabel('Product', { exact: true });
    await name.fill('');
    await page.getByLabel('Price (USD)').fill('-1');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toBeFocused();
    await expect(
      page.getByText('Enter a price of zero or more.'),
    ).toBeVisible();
    await shot(page, `brand-error-${color.toLowerCase()}`);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Arc desk lamp' }),
    ).toBeFocused();
  }
  await page.getByRole('link', { name: 'Arc desk lamp' }).click();
  const name = page.getByLabel('Product', { exact: true });
  await name.fill('');
  await name.pressSequentially('Reading lamp');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Reading lamp' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Arc desk lamp' })).toBeVisible();
  await expect(mode(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
});

test('preferences persist, synchronize between tabs and follow the system', async ({
  page,
  context,
}) => {
  await ready(page);
  const second = await context.newPage();
  await ready(second);
  await mode(page, 'Brand').click();
  await mode(page, 'Dark').click();
  await expect(mode(second, 'Brand')).toHaveAttribute('aria-pressed', 'true');
  await expect(mode(second, 'Dark')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(mode(page, 'Brand')).toHaveAttribute('aria-pressed', 'true');
  await mode(page, 'System').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.getByTestId('resolved-mode')).toHaveText(
    'Applied mode: Dark',
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.getByTestId('resolved-mode')).toHaveText(
    'Applied mode: Light',
  );
  await shot(page, 'system-light');
  await second.evaluate(() => localStorage.clear());
  await expect(mode(page, 'Compact')).toHaveAttribute('aria-pressed', 'true');
  await expect(mode(page, 'System')).toHaveAttribute('aria-pressed', 'true');
  await second.close();
});

test('fresh browser uses configured defaults without saving a preference', async ({
  page,
}) => {
  await ready(page);
  await expect(
    mode(page, process.env.THEME_EXPECT_MODE ?? 'System'),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    mode(page, process.env.THEME_EXPECT_PRESET ?? 'Compact'),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key.includes(':theme:')),
    ),
  ).toEqual([]);
  await shot(page, 'configured-defaults');
});

test('unavailable storage still permits in-memory appearance choices', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
    Storage.prototype.setItem = () => {
      throw new DOMException('Blocked', 'SecurityError');
    };
  });
  await ready(page);
  await mode(page, 'Brand').click();
  await mode(page, 'Dark').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'brand');
  await expect(page.locator('html')).toHaveClass('dark');
});
