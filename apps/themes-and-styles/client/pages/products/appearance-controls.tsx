import { useTranslation } from '@nocobase/i18n/client';
import { useTheme } from 'next-themes';
import type { ReactElement } from 'react';
import { Button } from '#components/ui/button';
import { useThemePreset } from '../../theme/theme-context.js';
import { themePresets } from '../../theme/theme-presets.js';

export function ColorModeControls(): ReactElement {
  const { t } = useTranslation();
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <fieldset className='flex min-w-0 flex-col gap-3'>
      <legend className='mb-3 text-sm font-medium'>
        {t('appearance.mode')}
      </legend>
      <div className='flex flex-wrap gap-2'>
        {(['light', 'dark', 'system'] as const).map((mode) => (
          <Button
            key={mode}
            variant={theme === mode ? 'default' : 'outline'}
            aria-pressed={theme === mode}
            onClick={() => setTheme(mode)}
          >
            {t(`appearance.${mode}`)}
          </Button>
        ))}
      </div>
      <p className='text-sm text-muted-foreground' data-testid='resolved-mode'>
        {t('products.appliedMode', {
          mode: t(`appearance.${resolvedTheme ?? 'light'}`),
        })}
      </p>
    </fieldset>
  );
}

export function PresetControls(): ReactElement {
  const { t } = useTranslation();
  const { preset, setPreset } = useThemePreset();
  return (
    <fieldset className='flex min-w-0 flex-col gap-3'>
      <legend className='mb-3 text-sm font-medium'>
        {t('appearance.preset')}
      </legend>
      <div className='flex flex-wrap gap-2'>
        {themePresets.map(({ id, labelKey }) => (
          <Button
            key={id}
            variant={preset === id ? 'default' : 'outline'}
            aria-pressed={preset === id}
            onClick={() => setPreset(id)}
          >
            {t(labelKey)}
          </Button>
        ))}
      </div>
      <p className='text-sm text-muted-foreground'>
        {t('products.savedAppearance')}
      </p>
    </fieldset>
  );
}
