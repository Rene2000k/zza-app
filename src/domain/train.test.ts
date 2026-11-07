import { describe, expect, it } from 'vitest';
import { serviceClass, trainLabel } from './train';

describe('train label', () => {
  it('is the line label where the train has one', () => {
    expect(trainLabel({ category: 'RE', number: '4211', line: 'RE60' })).toBe('RE60');
  });

  it('falls back to category and number for a train without a line', () => {
    expect(trainLabel({ category: 'ICE', number: '571' })).toBe('ICE 571');
  });
});

describe('service class', () => {
  it('tells long-distance trains by their category', () => {
    for (const category of ['ICE', 'IC', 'EC', 'FLX', 'NJ', 'RJX']) {
      expect(serviceClass({ category, number: '1' })).toBe('longDistance');
    }
  });

  it('tells an S-Bahn by its category, whatever its line', () => {
    expect(serviceClass({ category: 'S', number: '35862', line: 'S8' })).toBe('suburban');
  });

  it('tells an S-Bahn by its line where the operator has a category of its own', () => {
    // As IRIS delivers the S5 at Paderborn Hbf.
    expect(serviceClass({ category: 'SBH', number: '34543', line: 'S5' })).toBe('suburban');
    expect(serviceClass({ category: 'SBH', number: '34543', line: 'S 5' })).toBe('suburban');
  });

  it('does not take a line that merely starts with S for an S-Bahn', () => {
    expect(serviceClass({ category: 'RE', number: '1', line: 'SE4' })).toBe('regional');
  });

  it('counts every other category as regional', () => {
    for (const category of ['RE', 'RB', 'HLB', 'ME', 'NX', '']) {
      expect(serviceClass({ category, number: '1' })).toBe('regional');
    }
  });

  it('ignores case and stray spaces', () => {
    expect(serviceClass({ category: ' ice', number: '1' })).toBe('longDistance');
    expect(serviceClass({ category: 's ', number: '1' })).toBe('suburban');
  });
});
