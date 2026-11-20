import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrainFormationDisplay } from './TrainFormationDisplay';
import type { Coach, TrainFormation } from '@/domain/formation';

const coach = (number: string, section: string, extra: Partial<Coach> = {}): Coach => ({
  number,
  travelClass: 'second',
  section,
  lengthMetres: 26.4,
  features: [],
  ...extra,
});

const formation: TrainFormation = {
  coaches: [
    coach('11', 'B', { travelClass: 'first', features: ['controlCar'] }),
    coach('12', 'B', { travelClass: 'none', features: ['dining'] }),
    coach('13', 'C', { features: ['bicycles', 'wheelchair'] }),
    coach('14', 'D'),
    coach('15', 'D', { features: ['controlCar'] }),
  ],
  accuracy: 'scheduled',
};

const coaches = (container: HTMLElement) => [...container.querySelectorAll('[data-coach]')];

describe('TrainFormationDisplay', () => {
  it('rests as an empty coach strip without a formation', () => {
    const { container } = render(<TrainFormationDisplay formation={undefined} />);
    const root = container.firstElementChild;
    expect(root instanceof HTMLElement ? root.dataset['state'] : undefined).toBe('idle');
    expect(container.textContent?.trim()).toBe('');
  });

  it('shows the occupied Bahnsteigabschnitte in order, and only those', () => {
    render(<TrainFormationDisplay formation={formation} />);
    const letters = screen.getAllByText(/^[A-F]$/).map((element) => element.textContent);
    expect(letters).toEqual(['B', 'C', 'D']);
  });

  it('stands each letter over the coaches of its Bahnsteigabschnitt', () => {
    render(<TrainFormationDisplay formation={formation} />);
    const span = (letter: string) => screen.getByText(letter).style.gridColumn;
    expect([span('B'), span('C'), span('D')]).toEqual(['span 2', 'span 1', 'span 2']);
  });

  it('gives every coach one place in the strip, Zugspitze first, with its Bahnsteigabschnitt', () => {
    const { container } = render(<TrainFormationDisplay formation={formation} />);
    expect(
      coaches(container).map((element) => [
        element.getAttribute('data-coach'),
        element.getAttribute('data-section'),
      ]),
    ).toEqual([
      ['11', 'B'],
      ['12', 'B'],
      ['13', 'C'],
      ['14', 'D'],
      ['15', 'D'],
    ]);
  });

  it('labels each coach with its class by default, or with its number when asked', () => {
    const { container, rerender } = render(<TrainFormationDisplay formation={formation} />);
    expect(coaches(container).map((element) => element.textContent)).toEqual([
      '1',
      '',
      '2',
      '2',
      '2',
    ]);

    rerender(<TrainFormationDisplay formation={formation} coachLabel="number" />);
    expect(coaches(container).map((element) => element.textContent)).toEqual([
      '11',
      '',
      '13',
      '14',
      '15',
    ]);
  });

  it('shows knife and fork on a restaurant coach instead of its label', () => {
    const { container } = render(
      <TrainFormationDisplay formation={formation} coachLabel="number" />,
    );
    const restaurant = container.querySelector('[data-coach="12"]');
    expect(restaurant?.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
      'Restaurant',
    );
    expect(restaurant?.textContent).toBe('');
  });

  it('draws the slanted front of a control car only at its cab end', () => {
    const { container } = render(<TrainFormationDisplay formation={formation} />);
    expect(
      coaches(container).map((element) => element.querySelectorAll('[data-edge]').length),
    ).toEqual([1, 0, 0, 0, 1]);
  });

  it('slants a locomotive towards the middle at both ends, without a label', () => {
    const { container } = render(
      <TrainFormationDisplay
        coachLabel="number"
        formation={{
          coaches: [
            { travelClass: 'none', section: 'A', lengthMetres: 26.4, features: ['locomotive'] },
            coach('1', 'A'),
          ],
          accuracy: 'scheduled',
        }}
      />,
    );
    const [locomotive] = coaches(container);
    expect(locomotive?.getAttribute('data-shape')).toBe('locomotive');
    expect(
      [...(locomotive?.querySelectorAll('[data-edge]') ?? [])].map((edge) =>
        edge.getAttribute('data-edge'),
      ),
    ).toEqual(['nose-start', 'nose-end']);
    expect(locomotive?.textContent).toBe(' ');
  });

  it('draws a power car like a control car, cut at the end it faces, without a label', () => {
    const powerCar: Coach = {
      travelClass: 'none',
      section: 'A',
      lengthMetres: 20.9,
      features: ['powerCar'],
    };
    const { container } = render(
      <TrainFormationDisplay
        formation={{
          coaches: [powerCar, coach('1', 'A'), coach('2', 'B'), { ...powerCar, section: 'B' }],
          accuracy: 'scheduled',
        }}
      />,
    );
    const strip = coaches(container);
    expect(strip.map((element) => element.getAttribute('data-shape'))).toEqual([
      'cab-start',
      null,
      null,
      'cab-end',
    ]);
    expect(strip.map((element) => element.textContent)).toEqual([' ', '2', '2', ' ']);
  });

  const shapes = (...cars: readonly Coach[]) => {
    const { container } = render(
      <TrainFormationDisplay formation={{ coaches: cars, accuracy: 'scheduled' }} />,
    );
    return coaches(container).map((element) => element.getAttribute('data-shape'));
  };
  const controlCar = (number: string) => coach(number, 'A', { features: ['controlCar'] });
  const powerCar = (number: string) =>
    coach(number, 'A', { travelClass: 'none', features: ['powerCar'] });

  it('turns the cabs at the coupling of a double unit towards each other', () => {
    expect(
      shapes(
        controlCar('1'),
        coach('2', 'A'),
        controlCar('3'),
        controlCar('4'),
        coach('5', 'A'),
        controlCar('6'),
      ),
    ).toEqual(['cab-start', null, 'cab-end', 'cab-start', null, 'cab-end']);
  });

  it('turns a power car and a control car at a coupling towards each other', () => {
    expect(
      shapes(powerCar('1'), coach('2', 'A'), controlCar('3'), powerCar('4'), coach('5', 'A')),
    ).toEqual(['cab-start', null, 'cab-end', 'cab-start', null]);
  });

  it('turns a control car next to a locomotive towards it', () => {
    expect(
      shapes(
        coach('1', 'A', { travelClass: 'none', features: ['locomotive'] }),
        controlCar('2'),
        coach('3', 'A'),
        coach('4', 'A'),
        coach('5', 'A'),
      ),
    ).toEqual(['locomotive', 'cab-start', null, null, null]);
  });

  it('turns a lone cab inside the train by the half of the train it stands in', () => {
    expect(
      shapes(controlCar('1'), coach('2', 'A'), coach('3', 'A'), controlCar('4'), coach('5', 'A')),
    ).toEqual(['cab-start', null, null, 'cab-end', null]);
  });

  it('shows no label on a power car even where it has a number', () => {
    const { container } = render(
      <TrainFormationDisplay
        coachLabel="number"
        formation={{
          coaches: [
            coach('1', 'A', { travelClass: 'none', features: ['powerCar'] }),
            coach('2', 'A'),
          ],
          accuracy: 'scheduled',
        }}
      />,
    );
    expect(coaches(container)[0]?.textContent).toBe(' ');
  });

  it('marks each coach’s class and features for the design to draw', () => {
    const { container } = render(<TrainFormationDisplay formation={formation} />);
    expect(coaches(container).map((element) => element.getAttribute('data-class'))).toEqual([
      'first',
      'none',
      'second',
      'second',
      'second',
    ]);
    expect(container.querySelector('[data-features="bicycles wheelchair"]')).not.toBeNull();
  });

  it('closes a control car at the end of the train its cab faces', () => {
    const { container } = render(<TrainFormationDisplay formation={formation} />);
    expect(coaches(container).map((element) => element.getAttribute('data-shape'))).toEqual([
      'cab-start',
      null,
      null,
      null,
      'cab-end',
    ]);
  });

  it('turns a part-first-class coach’s first-class half towards the adjoining first class', () => {
    const { container } = render(
      <TrainFormationDisplay
        formation={{
          coaches: [
            coach('1', 'A', { travelClass: 'first' }),
            coach('2', 'A', { travelClass: 'mixed' }),
            coach('3', 'B'),
            coach('4', 'B', { travelClass: 'mixed' }),
            coach('5', 'C', { travelClass: 'first', features: ['dining'] }),
            coach('6', 'C', { travelClass: 'first' }),
            coach('7', 'D', { travelClass: 'mixed' }),
            coach('8', 'D'),
          ],
          accuracy: 'scheduled',
        }}
      />,
    );
    expect(
      coaches(container).map((element) => element.getAttribute('data-first-class-side')),
    ).toEqual([null, 'start', null, 'end', 'end', null, 'start', null]);
  });

  it('states no side for a mixed coach without first class next to it', () => {
    const { container } = render(
      <TrainFormationDisplay
        formation={{
          coaches: [coach('1', 'A'), coach('2', 'A', { travelClass: 'mixed' }), coach('3', 'B')],
          accuracy: 'scheduled',
        }}
      />,
    );
    expect(coaches(container)[1]?.getAttribute('data-first-class-side')).toBeNull();
  });

  it('draws coaches without a Bahnsteigabschnitt as a strip without a ruler', () => {
    const { container } = render(
      <TrainFormationDisplay
        formation={{
          coaches: [
            { number: '1', travelClass: 'second', lengthMetres: 26.4, features: [] },
            { number: '2', travelClass: 'second', lengthMetres: 26.4, features: [] },
          ],
          accuracy: 'scheduled',
        }}
      />,
    );
    expect(screen.queryByText(/^[A-F]$/)).toBeNull();
    expect(coaches(container)).toHaveLength(2);
  });
});
