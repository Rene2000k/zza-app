import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DisplayCanvas } from './DisplayCanvas';

const stubFrame = ({ width, height }: { width: number; height: number }) => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: height,
  });
};

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, 'clientWidth');
  Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight');
});

const canvas = { width: 960, height: 540 };

describe('DisplayCanvas', () => {
  it('scales the canvas to the frame', () => {
    stubFrame({ width: 480, height: 270 });
    render(
      <DisplayCanvas canvas={canvas}>
        <p>Anzeige</p>
      </DisplayCanvas>,
    );

    const scaled = screen.getByText('Anzeige').parentElement;
    expect(scaled?.dataset['scale']).toBe('0.5');
    expect(scaled?.style.transform).toBe('scale(0.5)');
    // The canvas keeps its native size; only the picture is scaled.
    expect(scaled?.style.width).toBe('960px');
  });

  it('fits the limiting side and letterboxes the other, keeping the aspect ratio', () => {
    stubFrame({ width: 1_920, height: 540 });
    render(
      <DisplayCanvas canvas={canvas}>
        <p>Anzeige</p>
      </DisplayCanvas>,
    );

    // Height is the constraint: 540 / 540, not 1920 / 960.
    expect(screen.getByText('Anzeige').parentElement?.dataset['scale']).toBe('1');
  });
});
