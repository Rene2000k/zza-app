import { describe, expect, it } from 'vitest';
import { parseConfig, toSearch } from './config';

describe('display configuration', () => {
  it('reads station and platform from a query string', () => {
    const result = parseConfig('?station=8000105&platform=9');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.station).toBe('8000105');
    expect(result.config.platform).toBe('9');
    expect(result.config.refreshSeconds).toBe(30);
  });

  it('rejects a station that is not an EVA number instead of guessing one', () => {
    const result = parseConfig('?station=Frankfurt');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join(' ')).toContain('station');
  });

  it('collects every problem at once', () => {
    const result = parseConfig('?station=abc&refreshSeconds=1');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toHaveLength(2);
  });

  it('keeps the poll interval within polite bounds', () => {
    expect(parseConfig('?station=8000105&refreshSeconds=5').ok).toBe(false);
    expect(parseConfig('?station=8000105&refreshSeconds=10').ok).toBe(true);
  });

  it('names the designs it knows when the configured one does not exist', () => {
    const result = parseConfig('?station=8000105&design=v9-9x9');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join(' ')).toContain('v9-9x9');
    expect(result.problems.join(' ')).toContain('debug');
  });

  it('names each bad parameter once, in German, with its query key', () => {
    const result = parseConfig('?station=8000105&refreshSeconds=2.5');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems).toEqual([
      'Abrufintervall (refreshSeconds): ganze Zahl von 10 bis 600 Sekunden',
    ]);
  });

  it('rejects an unknown provider instead of failing when the display starts', () => {
    const result = parseConfig('?station=8000105&provider=vendo');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.join(' ')).toContain('„vendo“ gibt es nicht');
    expect(result.problems.join(' ')).toContain('iris');
  });

  it('round-trips through a share link', () => {
    const parsed = parseConfig('?station=8000105&platform=1a&refreshSeconds=45');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const again = parseConfig(`?${toSearch(parsed.config)}`);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.config).toEqual(parsed.config);
  });

  it('accepts a simulated time for the demo clock', () => {
    const result = parseConfig(
      '?station=8000105&simulatedTime=2026-09-09T08:00:00%2B02:00&timeFactor=60',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.config.timeFactor).toBe(60);
  });
});
