import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FittedText } from './FittedText';

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

describe('FittedText', () => {
  it('leaves text that fits alone', () => {
    stubWidths({ content: 100, field: 300 });
    render(<FittedText>Gießen</FittedText>);
    expect(screen.getByText('Gießen').dataset['scale']).toBe('1');
  });

  it('squeezes text that is too wide, instead of cutting it', () => {
    stubWidths({ content: 300, field: 200 });
    render(<FittedText>Frankfurt(M) Flughafen Fernbf</FittedText>);

    const content = screen.getByText('Frankfurt(M) Flughafen Fernbf');
    expect(Number(content.dataset['scale'])).toBeCloseTo(0.666, 2);
    expect(content.style.transform).toMatch(/scaleX/);
  });

  it('stops squeezing at the readable minimum and clips the rest', () => {
    stubWidths({ content: 1_000, field: 200 });
    render(<FittedText minScale={0.6}>Berlin Gesundbrunnen über Kassel-Wilhelmshöhe</FittedText>);

    const content = screen.getByText('Berlin Gesundbrunnen über Kassel-Wilhelmshöhe');
    expect(Number(content.dataset['scale'])).toBe(0.6);
  });
});
