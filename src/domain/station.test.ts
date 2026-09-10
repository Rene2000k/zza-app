import { describe, expect, it } from 'vitest';
import { isSamePlatform, normalisePlatform } from './station';

describe('platform comparison', () => {
  it('matches labels that differ only in spelling', () => {
    expect(isSamePlatform('9', ' 9 ')).toBe(true);
    expect(isSamePlatform('9', 'Gl. 9')).toBe(true);
    expect(isSamePlatform('9', 'Gleis 9')).toBe(true);
    expect(isSamePlatform('1a', '1A')).toBe(true);
  });

  it('keeps genuinely different platforms apart', () => {
    // The dangerous pair: a naive prefix or numeric comparison would confuse these.
    expect(isSamePlatform('9', '19')).toBe(false);
    expect(isSamePlatform('9', '109')).toBe(false);
    expect(isSamePlatform('1', '1a')).toBe(false);
  });

  it('treats an unknown platform as never matching', () => {
    expect(isSamePlatform(undefined, '9')).toBe(false);
    expect(isSamePlatform('9', undefined)).toBe(false);
    expect(isSamePlatform(undefined, undefined)).toBe(false);
  });

  it('normalises to a comparable form', () => {
    expect(normalisePlatform('Gleis 12')).toBe('12');
  });
});
