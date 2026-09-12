import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ticker } from './Ticker';

describe('Ticker', () => {
  it('runs the resolved messages and drops a code without text', () => {
    render(
      <Ticker
        messages={[
          { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges' },
          { kind: 'delayCause', code: '9999' },
          { kind: 'info', text: 'Gleiswechsel' },
        ]}
      />,
    );
    expect(screen.getByRole('marquee').textContent).toBe(
      'Verspätung eines vorausfahrenden Zuges - Gleiswechsel',
    );
    expect(screen.queryByText(/9999/)).toBeNull();
  });

  it('takes the separator from the design', () => {
    render(
      <Ticker
        messages={[
          { kind: 'info', text: 'eins' },
          { kind: 'info', text: 'zwei' },
        ]}
        separator=" +++ "
      />,
    );
    expect(screen.getByRole('marquee').textContent).toBe('eins +++ zwei');
  });

  it('closes a line of several messages with the separator when the design asks for it', () => {
    const { rerender } = render(
      <Ticker
        messages={[
          { kind: 'info', text: 'eins' },
          { kind: 'info', text: 'zwei' },
        ]}
        separator=" +++ "
        closeWithSeparator
      />,
    );
    expect(screen.getByRole('marquee').textContent).toBe('eins +++ zwei +++');

    rerender(
      <Ticker messages={[{ kind: 'info', text: 'eins' }]} separator=" +++ " closeWithSeparator />,
    );
    expect(screen.getByRole('marquee').textContent).toBe('eins');
  });

  it('renders nothing when no message has a text', () => {
    render(<Ticker messages={[{ kind: 'delayCause', code: '9999' }]} />);
    expect(screen.queryByRole('marquee')).toBeNull();
  });
});
