import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DebugDesign } from './DebugDesign';
import type { DepartureEntry } from '@/domain/boardEntry';
import type { RouteChange } from '@/domain/routeChange';
import type { ReadyBoard } from '@/hooks/useZzaBoard';

const planned = new Date(Date.UTC(2026, 8, 11, 8, 4));

const skipped: RouteChange = { kind: 'skippedStops', stops: [{ name: 'Darmstadt Hbf' }] };

const departure = (overrides: Partial<DepartureEntry> & { id: string }): DepartureEntry => ({
  kind: 'departure',
  train: { category: 'ICE', number: '571' },
  platform: { planned: '9', actual: '9', changed: false },
  time: { planned, expected: planned },
  status: 'onTime',
  messages: [],
  routeChanges: [],
  destination: { name: 'Stuttgart Hbf' },
  via: [],
  ...overrides,
});

const ready = (overrides: Partial<ReadyBoard>): ReadyBoard => ({
  state: 'ready',
  station: { evaNumber: '8000105', name: 'Frankfurt(Main)Hbf' },
  platform: '9',
  current: undefined,
  secondPart: undefined,
  following: [],
  entries: [],
  now: new Date(Date.UTC(2026, 8, 11, 8, 0)),
  messages: [],
  dataAgeSeconds: 4,
  stale: false,
  ...overrides,
});

describe('debug design', () => {
  it('shouts the route changes of a running train', () => {
    render(
      <DebugDesign board={ready({ current: departure({ id: 'x', routeChanges: [skipped] }) })} />,
    );
    expect(screen.getByText('OHNE: Darmstadt Hbf')).toBeDefined();
  });

  it('announces no route change for a cancelled train', () => {
    const current = departure({ id: 'x', status: 'cancelled', routeChanges: [skipped] });
    render(<DebugDesign board={ready({ current })} />);
    expect(screen.queryByText(/OHNE/)).toBeNull();
    expect(screen.getAllByText('FÄLLT AUS').length).toBeGreaterThan(0);
  });

  it('names the platform a train moved to away from the display', () => {
    const current = departure({ id: 'x', platform: { planned: '9', actual: '12', changed: true } });
    render(<DebugDesign board={ready({ current })} />);
    expect(screen.getByText('GLEIS 12')).toBeDefined();
  });
});
