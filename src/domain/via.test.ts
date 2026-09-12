import { describe, expect, it } from 'vitest';
import { selectViaStops } from './via';
import type { RouteStop } from './station';

const stop = (name: string): RouteStop => ({ name });
const stops = (...names: string[]): RouteStop[] => names.map(stop);

describe('selectViaStops (ADR-0005)', () => {
  it('keeps everything when the list already fits', () => {
    const via = stops('a', 'b');
    expect(selectViaStops(via, 3)).toEqual({ stops: via, omittedCount: 0 });
  });

  it('keeps everything when the list exactly matches the cap', () => {
    const via = stops('a', 'b', 'c');
    expect(selectViaStops(via, 3)).toEqual({ stops: via, omittedCount: 0 });
  });

  it('keeps the next stops in travel order when over the cap', () => {
    const via = stops('a', 'b', 'c', 'd', 'e');
    expect(selectViaStops(via, 3)).toEqual({ stops: stops('a', 'b', 'c'), omittedCount: 2 });
  });

  it('keeps only the next stop when the cap is 1', () => {
    const via = stops('a', 'b', 'c');
    expect(selectViaStops(via, 1)).toEqual({ stops: stops('a'), omittedCount: 2 });
  });

  it('drops everything when the cap is 0', () => {
    const via = stops('a', 'b');
    expect(selectViaStops(via, 0)).toEqual({ stops: [], omittedCount: 2 });
  });

  it('handles an empty via list', () => {
    expect(selectViaStops([], 3)).toEqual({ stops: [], omittedCount: 0 });
  });
});
