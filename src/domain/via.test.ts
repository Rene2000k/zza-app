import { describe, expect, it } from 'vitest';
import { selectViaStops } from './via';
import type { StationRef } from './station';

const stop = (name: string): StationRef => ({ evaNumber: name, name });
const stops = (...names: string[]): StationRef[] => names.map(stop);

describe('selectViaStops (ADR-0005)', () => {
  it('keeps everything when the list already fits', () => {
    const via = stops('a', 'b');
    expect(selectViaStops(via, 3)).toEqual({ stops: via, omittedCount: 0 });
  });

  it('keeps everything when the list exactly matches the cap', () => {
    const via = stops('a', 'b', 'c');
    expect(selectViaStops(via, 3)).toEqual({ stops: via, omittedCount: 0 });
  });

  it('keeps the leading stops plus the final approach stop when over the cap', () => {
    const via = stops('a', 'b', 'c', 'd', 'e');
    expect(selectViaStops(via, 3)).toEqual({ stops: stops('a', 'b', 'e'), omittedCount: 2 });
  });

  it('keeps only the final stop when the cap is 1 and there is more than one stop', () => {
    const via = stops('a', 'b', 'c');
    expect(selectViaStops(via, 1)).toEqual({ stops: stops('c'), omittedCount: 2 });
  });

  it('drops everything when the cap is 0', () => {
    const via = stops('a', 'b');
    expect(selectViaStops(via, 0)).toEqual({ stops: [], omittedCount: 2 });
  });

  it('handles an empty via list', () => {
    expect(selectViaStops([], 3)).toEqual({ stops: [], omittedCount: 0 });
  });
});
