import { describe, expect, it } from 'vitest';
import { formatDay } from '../../client/pages/requests/format.js';

describe('formatDay', () => {
  it('shows a calendar date without a time, the same day in every time zone', () => {
    expect(formatDay('2026-11-06', 'en-US')).toBe('Nov 6, 2026');
    expect(formatDay('2026-11-06', 'zh-CN')).toBe('2026年11月6日');
  });

  it('shows a dash for requests submitted before the field existed', () => {
    expect(formatDay(null, 'en-US')).toBe('—');
    expect(formatDay('', 'en-US')).toBe('—');
  });
});
