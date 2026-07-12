import { ageStr, fromIsoDate, monthLabel, shortDate, toIsoDate } from './dates';

describe('toIsoDate', () => {
  it('formats a local Date as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2024, 0, 5))).toBe('2024-01-05');
  });

  it('pads single-digit months and days', () => {
    expect(toIsoDate(new Date(2024, 8, 9))).toBe('2024-09-09');
  });
});

describe('fromIsoDate', () => {
  it('parses YYYY-MM-DD into a local Date with matching Y/M/D fields', () => {
    const d = fromIsoDate('2024-01-05');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(5);
  });

  it('round-trips with toIsoDate', () => {
    expect(toIsoDate(fromIsoDate('2023-12-31'))).toBe('2023-12-31');
  });
});

describe('monthLabel', () => {
  it('renders the full month name and year', () => {
    expect(monthLabel('2024-03-15')).toBe('March 2024');
  });

  it('handles December correctly (index boundary)', () => {
    expect(monthLabel('2024-12-01')).toBe('December 2024');
  });
});

describe('shortDate', () => {
  it('renders abbreviated month and un-padded day', () => {
    expect(shortDate('2024-03-05')).toBe('Mar 5');
  });

  it('does not zero-pad the day', () => {
    expect(shortDate('2024-11-30')).toBe('Nov 30');
  });
});

describe('ageStr', () => {
  it('returns empty string for null birthdate', () => {
    expect(ageStr(null)).toBe('');
  });

  it('reports months for a pet under a year old', () => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 5, 15)); // 2024-06-15
    expect(ageStr('2024-01-15')).toBe('5 mo');
    jest.useRealTimers();
  });

  it('reports years for a pet at least a year old', () => {
    jest.useFakeTimers().setSystemTime(new Date(2024, 5, 15)); // 2024-06-15
    expect(ageStr('2020-06-15')).toBe('4 yr');
    jest.useRealTimers();
  });

  // Regression test for a fixed bug: ageStr used to parse the ISO birthdate
  // with `new Date(iso)`, which the file's own module comment warns against
  // ("going through toISOString()/`new Date(iso)` shifts the day near
  // midnight in timezones behind UTC"). That shift silently overcounted age
  // by up to a year near a birthday/year boundary in any timezone behind
  // UTC.
  //
  // This needs the process itself to be running in a timezone behind UTC —
  // reassigning process.env.TZ mid-test does NOT reliably work, because V8
  // caches the resolved local timezone the first time any Date/Intl call
  // happens in the process and ignores later reassignments. So the `test`
  // npm script pins TZ=Pacific/Honolulu (UTC-10, no DST, so this is
  // deterministic year-round) for the whole Jest run instead.
  it('does not overcount age near a UTC day-boundary in timezones behind UTC', () => {
    // 2026-01-01T08:00:00Z == 2025-12-31 22:00 HST
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T08:00:00Z'));

    // Birthdate is local Jan 1, 2020 → true age on Dec 31, 2025 (HST) is 5 yr.
    const result = ageStr('2020-01-01');

    jest.useRealTimers();

    expect(result).toBe('5 yr');
  });
});
