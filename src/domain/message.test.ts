import { describe, expect, it } from 'vitest';
import { PLATFORM_QUALITY_TOPICS, uniqueMessages } from './message';
import type { BoardMessage, QualityTopic } from './message';

describe('unique messages', () => {
  it('says a text once, keeping its first occurrence', () => {
    const fromStop: BoardMessage = { kind: 'cancellation', code: '1', text: 'Zug fällt aus' };
    const fromMovement: BoardMessage = { kind: 'info', code: '2', text: 'Zug fällt aus' };
    const other: BoardMessage = { kind: 'disruption', text: 'Störung' };

    expect(uniqueMessages([fromStop, other, fromMovement])).toEqual([fromStop, other]);
  });

  it('leaves out messages without a text to show', () => {
    expect(
      uniqueMessages([
        { kind: 'delayCause', code: '99' },
        { kind: 'info', text: '  ' },
        { kind: 'info', text: 'Information' },
      ]),
    ).toEqual([{ kind: 'info', text: 'Information' }]);
  });
});

describe('platform quality topics', () => {
  it('holds what a traveller on the platform can still act on', () => {
    const shown: QualityTopic[] = [
      'coachOrder',
      'missingCoaches',
      'bicycle',
      'catering',
      'accessibility',
      'occupancy',
      'busReplacement',
    ];
    for (const topic of shown) {
      expect(PLATFORM_QUALITY_TOPICS.has(topic)).toBe(true);
    }
  });

  it('leaves out on-board services, reservations and shortcomings without a subject', () => {
    const leftOut: QualityTopic[] = ['onboardServices', 'reservation', 'other'];
    for (const topic of leftOut) {
      expect(PLATFORM_QUALITY_TOPICS.has(topic)).toBe(false);
    }
  });
});
