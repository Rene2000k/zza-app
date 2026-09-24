import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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

  describe('closing with the separator', () => {
    /** jsdom lays nothing out; the widths decide whether the line runs. */
    const stubWidths = (content: number) => {
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
        configurable: true,
        value: content,
      });
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        value: 400,
      });
    };

    afterEach(() => {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
      Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
    });

    /** The track's pieces in order: content, closing, then the gap-led copy. */
    const pieces = (): (string | null)[] =>
      Array.from(
        screen.getByRole('marquee').querySelector('[data-scrolling] > div')?.children ?? [],
      ).map((piece) => piece.textContent);

    it('ends a running line on the separator, a single message too', () => {
      stubWidths(900);
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
      expect(pieces()).toEqual(['eins +++ zwei', ' +++', ' eins +++ zwei +++']);

      rerender(
        <Ticker messages={[{ kind: 'info', text: 'eins' }]} separator=" +++ " closeWithSeparator />,
      );
      expect(pieces()).toEqual(['eins', ' +++', ' eins +++']);
    });

    it('leaves a line that stands still bare', () => {
      stubWidths(100);
      render(
        <Ticker
          messages={[
            { kind: 'info', text: 'eins' },
            { kind: 'info', text: 'zwei' },
          ]}
          separator=" +++ "
          closeWithSeparator
        />,
      );
      expect(screen.getByRole('marquee').textContent).toBe('eins +++ zwei');
    });
  });

  it('renders nothing when no message has a text', () => {
    render(<Ticker messages={[{ kind: 'delayCause', code: '9999' }]} />);
    expect(screen.queryByRole('marquee')).toBeNull();
  });
});
