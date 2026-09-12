import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClockContext } from './ClockContext';
import { DesignHost } from './DesignHost';
import { displayConfigSchema } from './config';
import { fixedClock, manualClock } from '@/platform/clock';
import type { Clock } from '@/platform/clock';

/**
 * The whole chain, end to end: provider → domain model → view model → registry → design.
 * The assertions are against the debug design's own wording, which is the point — the layers
 * below it decide none of that.
 */
const renderDisplay = (
  overrides: Record<string, unknown> = {},
  clock: Clock = fixedClock(new Date('2026-09-09T08:00:00+02:00')),
) => {
  const config = displayConfigSchema.parse({ station: '8000105', provider: 'mock', ...overrides });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <ClockContext.Provider value={clock}>
      <QueryClientProvider client={queryClient}>
        <DesignHost config={config} />
      </QueryClientProvider>
    </ClockContext.Provider>,
  );
};

describe('design host', () => {
  it('shows the configured station and its next train', async () => {
    renderDisplay({ platform: '9' });
    expect(await screen.findByText('Frankfurt(Main)Hbf')).toBeDefined();
    expect(await screen.findByText('ICE 571')).toBeDefined();
    expect(await screen.findByText('Stuttgart Hbf')).toBeDefined();
  });

  it('leads a terminating train with where it came from (ADR-0003)', async () => {
    renderDisplay({ platform: '9' });
    expect(await screen.findByText('von Dieburg')).toBeDefined();
  });

  it('keeps a train that left this platform and says where it goes from (ADR-0006)', async () => {
    renderDisplay({ platform: '9' });
    // RE 4271 was planned on 9 and moved to 4; platform 9 must still announce it.
    expect(await screen.findByText('RE59')).toBeDefined();
    expect(await screen.findByText('GLEIS 4')).toBeDefined();
  });

  it('filters to a single platform', async () => {
    renderDisplay({ platform: '12' });
    expect(await screen.findByText('RE60')).toBeDefined();
    expect(screen.queryByText('ICE 571')).toBeNull();
  });

  it('shows nothing for a delay cause the project cannot resolve', async () => {
    renderDisplay({ platform: '9' });
    await screen.findByText('ICE 571');
    expect(screen.queryByText(/9999/)).toBeNull();
  });

  it('says the data is stale once it is older than three poll intervals', async () => {
    const clock = manualClock(new Date('2026-09-09T08:00:00+02:00'));
    renderDisplay({ platform: '9' }, clock);
    await screen.findByText('ICE 571');
    expect(screen.queryByText(/veraltet/)).toBeNull();

    clock.advance(91_000);
    expect(await screen.findByText(/veraltet/, {}, { timeout: 2_000 })).toBeDefined();
  });

  it('reports an unknown design instead of rendering nothing', async () => {
    // parseConfig rejects an unknown id before this point; the host still has to have an
    // answer, because a registry can be edited and a stored link cannot.
    const config = displayConfigSchema.parse({
      station: '8000105',
      provider: 'mock',
      design: 'does-not-exist',
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ClockContext.Provider value={fixedClock(new Date('2026-09-09T08:00:00+02:00'))}>
        <QueryClientProvider client={queryClient}>
          <DesignHost config={config} />
        </QueryClientProvider>
      </ClockContext.Provider>,
    );

    expect(await screen.findByRole('alert')).toBeDefined();
  });
});
