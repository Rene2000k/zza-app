import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ClockContext } from './ClockContext';
import { SmokeBoard } from './SmokeBoard';
import { displayConfigSchema } from './config';
import { fixedClock } from '@/platform/clock';

/**
 * End-to-end through the layers: provider → domain model → hook → React.
 * A frozen clock makes the expected output exact (ADR-0004).
 */
const renderBoard = (overrides: Record<string, unknown> = {}) => {
  const config = displayConfigSchema.parse({ station: '8000105', provider: 'mock', ...overrides });
  const clock = fixedClock(new Date('2026-09-09T08:00:00+02:00'));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <ClockContext.Provider value={clock}>
      <QueryClientProvider client={queryClient}>
        <SmokeBoard config={config} />
      </QueryClientProvider>
    </ClockContext.Provider>,
  );
};

describe('smoke board', () => {
  it('shows the station and its departures', async () => {
    renderBoard();
    expect(await screen.findByRole('heading', { name: /Frankfurt\(Main\)Hbf/ })).toBeDefined();
    expect(await screen.findByText('ICE 571')).toBeDefined();
    expect(await screen.findByText(/Stuttgart Hbf/)).toBeDefined();
  });

  it('leads a terminating train with its origin and says it ends here', async () => {
    renderBoard();
    expect(await screen.findByText(/von Dieburg · endet hier/)).toBeDefined();
  });

  it('marks a platform change', async () => {
    renderBoard();
    expect(await screen.findByText(/geändert/)).toBeDefined();
  });

  it('shows nothing for a delay cause the project cannot resolve', async () => {
    renderBoard();
    // ICE 1006 carries code 9999 with no text: the cell stays empty rather than
    // printing a bare number at travellers.
    await screen.findByText('ICE 1006');
    expect(screen.queryByText(/9999/)).toBeNull();
  });

  it('filters to a single platform', async () => {
    renderBoard({ platform: '12' });
    expect(await screen.findByText('RE 4168')).toBeDefined();
    expect(screen.queryByText('ICE 571')).toBeNull();
  });
});
