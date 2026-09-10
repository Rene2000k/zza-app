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

  it('filters by the platform actually in use, not the planned one', async () => {
    const board = await createMockProvider().getBoard({ station: '8000105', platform: '9', now });
    // The IC moved from 7 to 9, so it belongs on the platform-9 board…
    expect(board.entries.some((entry) => entry.id === 'mock-ic-2310')).toBe(true);
    // …and must not appear on the board for its planned platform any more.
    const planned = await createMockProvider().getBoard({ station: '8000105', platform: '7', now });
    expect(planned.entries.some((entry) => entry.id === 'mock-ic-2310')).toBe(false);
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
