import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrainFormationDisplay } from './TrainFormationDisplay';
import type { TrainFormation } from '@/domain/formation';

describe('TrainFormationDisplay', () => {
  it('rests as an empty coach strip without a formation', () => {
    const { container } = render(<TrainFormationDisplay formation={undefined} />);
    const root = container.firstElementChild;
    expect(root instanceof HTMLElement ? root.dataset['state'] : undefined).toBe('idle');
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows the sections above the coaches and carries each coach’s features', () => {
    const formation: TrainFormation = {
      sections: ['A', 'B', 'C'],
      coaches: [
        { number: '11', travelClass: 'first', features: [] },
        { number: '12', travelClass: 'none', features: ['dining'] },
        { number: '13', travelClass: 'second', features: ['bicycles', 'wheelchair'] },
      ],
      accuracy: 'scheduled',
    };
    const { container } = render(<TrainFormationDisplay formation={formation} />);
    for (const text of ['A', 'B', 'C', '1', '2']) {
      expect(screen.getByText(text)).toBeDefined();
    }
    expect(container.querySelector('[data-features="bicycles wheelchair"]')).not.toBeNull();
  });
});
