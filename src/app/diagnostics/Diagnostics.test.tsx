import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Diagnostics } from './Diagnostics';
import { DiagnosticsOverlay } from './DiagnosticsOverlay';
import { createDiagnosticsLog } from './diagnosticsLog';
import { displayConfigSchema } from '../config';
import { manualClock } from '@/platform/clock';
import type { ZzaBoardViewModel } from '@/hooks/useZzaBoard';

const config = displayConfigSchema.parse({ station: '8000105', platform: '9', provider: 'mock' });

const setup = (board: ZzaBoardViewModel = { state: 'loading' }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const log = createDiagnosticsLog(manualClock(new Date('2026-10-01T18:00:00Z')), () => undefined);
  render(
    <QueryClientProvider client={client}>
      <Diagnostics config={config} log={log}>
        <DiagnosticsOverlay config={config} board={board} />
      </Diagnostics>
    </QueryClientProvider>,
  );
  return { client, log };
};

const texts = (log: ReturnType<typeof createDiagnosticsLog>) =>
  log.getSnapshot().entries.map((entry) => entry.text);

describe('diagnostics recording', () => {
  it('notes the start with the configuration', () => {
    const { log } = setup();
    expect(texts(log)[0]).toContain('Bahnhof 8000105, Gleis 9');
  });

  it('records board polls, but not other queries', async () => {
    const { client, log } = setup();

    await act(() => client.fetchQuery({ queryKey: ['board', 'x'], queryFn: () => 1 }));
    await act(() =>
      client
        .fetchQuery({ queryKey: ['board', 'y'], queryFn: () => Promise.reject(new Error('503')) })
        .catch(() => undefined),
    );
    await act(() => client.fetchQuery({ queryKey: ['station', 'x'], queryFn: () => 1 }));

    expect(log.getSnapshot()).toMatchObject({ successes: 1, failures: 1 });
  });

  it('records the browser going offline, where polling pauses instead of failing', () => {
    const { log } = setup();
    act(() => {
      window.dispatchEvent(new Event('offline'));
      window.dispatchEvent(new Event('online'));
    });
    expect(texts(log)).toContain('Browser meldet: offline');
    expect(texts(log)).toContain('Browser meldet: wieder online');
  });
});

describe('diagnostics view', () => {
  it('is hidden until "d" is pressed, and goes away on the next "d"', () => {
    setup();
    expect(screen.queryByRole('complementary', { name: 'Diagnose' })).toBeNull();

    fireEvent.keyDown(window, { key: 'd' });
    expect(screen.getByRole('complementary', { name: 'Diagnose' })).toBeDefined();

    fireEvent.keyDown(window, { key: 'd' });
    expect(screen.queryByRole('complementary', { name: 'Diagnose' })).toBeNull();
  });

  it('shows the counters and the latest failure', () => {
    const { log } = setup();
    fireEvent.keyDown(window, { key: 'd' });
    act(() => {
      log.boardSucceeded();
      log.boardFailed(new Error('Board fetch did not finish within 10000 ms'));
    });

    expect(screen.getByText('1 ok · 1 fehlgeschlagen')).toBeDefined();
    expect(screen.getAllByText(/did not finish/).length).toBeGreaterThan(0);
  });

  it('shows the train on screen as the design got it', () => {
    setup({
      state: 'ready',
      station: { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf' },
      platform: '9',
      current: undefined,
      secondPart: undefined,
      following: [],
      entries: [],
      now: new Date('2026-09-11T10:00:00+02:00'),
      messages: [],
      dataAgeSeconds: 42,
      stale: false,
    });
    fireEvent.keyDown(window, { key: 'd' });
    expect(screen.getByText('42 s')).toBeDefined();
  });
});
