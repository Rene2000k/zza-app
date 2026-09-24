import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Marquee } from './Marquee';

/**
 * jsdom lays nothing out, so the widths are stubbed. What can be checked here is the
 * decision — run or stand still — and the second copy that makes the loop seamless; the
 * animation itself needs Web Animations, which jsdom does not have.
 */
const stubWidths = ({ content, field }: { content: number; field: number }) => {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    value: content,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: field });
};

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
});

describe('Marquee', () => {
  it('leaves content that fits standing, in one copy', () => {
    stubWidths({ content: 120, field: 400 });
    const { container } = render(<Marquee>kurze Meldung</Marquee>);

    expect(container.querySelector('[data-scrolling="false"]')).not.toBeNull();
    expect(screen.getAllByText('kurze Meldung')).toHaveLength(1);
  });

  it('runs content that is too wide, and repeats it for a seamless loop', () => {
    stubWidths({ content: 900, field: 400 });
    const { container } = render(<Marquee>eine sehr lange Meldung</Marquee>);

    expect(container.querySelector('[data-scrolling="true"]')).not.toBeNull();
    const copies = screen.getAllByText('eine sehr lange Meldung');
    expect(copies).toHaveLength(2);
    // The repetition is decoration; a screen reader should hear the text once.
    expect(copies[1]?.getAttribute('aria-hidden')).toBe('true');
  });

  it('puts a gap given as text in front of the copy, kept as written', () => {
    stubWidths({ content: 900, field: 400 });
    const { container } = render(<Marquee gap=" ">eins +++ zwei +++</Marquee>);

    const copy = container.querySelector('[aria-hidden="true"]');
    expect(copy?.textContent).toBe(' eins +++ zwei +++');
    expect(copy?.getAttribute('style')).toBeNull();
    expect(copy?.querySelector('span')?.style.whiteSpace).toBe('pre');
  });
});
