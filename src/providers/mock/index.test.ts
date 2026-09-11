import { describe, expect, it } from 'vitest';
import { createMockProvider } from './index';

const now = new Date('2026-09-09T08:00:00+02:00');

describe('mock provider', () => {
  it('returns a board ordered by time', async () => {
    const board = await createMockProvider().getBoard({ station: '8000105', now });
    expect(board.station.name).toBe('Frankfurt(Main)Hbf');
    expect(board.entries.length).toBeGreaterThan(0);
    expect(board.fetchedAt).toBe(now);
  });

  it('keeps a platform-changed entry on both the old and the new platform (ADR-0006)', async () => {
    const provider = createMockProvider();
    // The IC moved from 7 to 9: shown where it now actually runs…
    const nine = await provider.getBoard({ station: '8000105', platform: '9', now });
    expect(nine.entries.some((entry) => entry.id === 'mock-ic-2310')).toBe(true);
    // …and still announced on 7, the platform it left, carrying the new platform and the
    // changed flag rather than disappearing as if the data had failed.
    const seven = await provider.getBoard({ station: '8000105', platform: '7', now });
    const onSeven = seven.entries.find((entry) => entry.id === 'mock-ic-2310');
    expect(onSeven?.platform).toEqual({ planned: '7', actual: '9', changed: true });
  });

  it('excludes entries with no planned or actual claim on the requested platform', async () => {
    const board = await createMockProvider().getBoard({ station: '8000105', platform: '12', now });
    expect(board.entries.some((entry) => entry.id === 'mock-ic-2310')).toBe(false);
  });

  it('resolves stations by name, EVA number and operational code', async () => {
    const provider = createMockProvider();
    expect(await provider.resolveStation('köln')).toHaveLength(1);
    expect(await provider.resolveStation('8000760')).toHaveLength(1);
    expect(await provider.resolveStation('FF')).toHaveLength(1);
    expect(await provider.resolveStation('Nirgendwo')).toHaveLength(0);
  });

  it('does not claim formation support it has no data for', () => {
    expect(createMockProvider().capabilities.formations).toBe(false);
  });
});
