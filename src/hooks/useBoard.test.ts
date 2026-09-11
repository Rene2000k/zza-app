import { describe, expect, it } from 'vitest';
import { jitteredIntervalMs } from './useBoard';

describe('jitteredIntervalMs', () => {
  it('varies the configured interval by at most ±10 %', () => {
    expect(jitteredIntervalMs(30, () => 0)).toBe(27_000);
    expect(jitteredIntervalMs(30, () => 0.5)).toBe(30_000);
    expect(jitteredIntervalMs(30, () => 0.999_999)).toBe(33_000);
  });
});
