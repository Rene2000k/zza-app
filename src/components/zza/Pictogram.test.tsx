import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pictogram } from './Pictogram';

describe('Pictogram', () => {
  it('names what it shows, for anyone who cannot see it', () => {
    render(
      <>
        <Pictogram id="haltPlus" />
        <Pictogram id="haltMinus" />
        <Pictogram id="platformChange" />
        <Pictogram id="trainSplit" />
        <Pictogram id="clock" />
        <Pictogram id="train" />
        <Pictogram id="sBahn" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Uhrzeit' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Zug' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'S-Bahn' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Zusätzlicher Halt' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Halt entfällt' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Gleiswechsel' })).toBeDefined();
    expect(screen.getByRole('img', { name: 'Zugteilung' })).toBeDefined();
  });

  it('is one em tall and paints in the colour of its surroundings', () => {
    render(<Pictogram id="haltPlus" />);
    const svg = screen.getByRole('img');
    expect(svg.getAttribute('height')).toBe('1em');
    expect(svg.getAttribute('fill')).toBe('currentColor');
  });
});
