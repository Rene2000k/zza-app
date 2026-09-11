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
    // Two fixture entries change platform (ADR-0006); this checks the marker is on the
    // one that moved onto platform 9, not just that the text occurs somewhere.
    const row = (await screen.findByText('IC 2310')).closest('tr');
    expect(row).not.toBeNull();
    expect(row?.textContent).toMatch(/geändert/);
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

  it('keeps an entry on the platform it left, not just the one it moved to (ADR-0006)', async () => {
    renderBoard({ platform: '9' });
    // RE 4271 was planned on 9 and moved to 4; platform 9's board must still announce it.
    const row = (await screen.findByText('RE 4271')).closest('tr');
    expect(row?.textContent).toMatch(/4.*\(geändert\)/);
  });
});
