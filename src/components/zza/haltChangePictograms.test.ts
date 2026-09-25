import { describe, expect, it } from 'vitest';
import { haltChangePictograms } from './haltChangePictograms';
import type { DepartureEntry, TerminatingArrivalEntry } from '@/domain/boardEntry';
import type { RouteChange } from '@/domain/routeChange';

const planned = new Date('2026-09-24T10:52:00+02:00');

const departure = (routeChanges: readonly RouteChange[]): DepartureEntry => ({
  kind: 'departure',
  id: 'ice-574',
  train: { category: 'ICE', number: '574' },
  platform: { planned: '9', actual: '9', changed: false },
  time: { planned, expected: planned },
  status: 'onTime',
  messages: [],
  routeChanges,
  destination: { name: 'Hamburg Hbf' },
  via: [],
});

const skipped: RouteChange = { kind: 'skippedStops', stops: [{ name: 'Göttingen' }] };
const endsEarly: RouteChange = { kind: 'endsEarly', stops: [{ name: 'Hamburg-Altona' }] };
const additional: RouteChange = { kind: 'additionalStops', stops: [{ name: 'Hamburg-Harburg' }] };

describe('haltChangePictograms', () => {
  it('shows nothing for a train on its timetabled route', () => {
    expect(haltChangePictograms(departure([]))).toEqual([]);
  });

  it('shows H+ for additional stops', () => {
    expect(haltChangePictograms(departure([additional]))).toEqual(['haltPlus']);
  });

  it('shows H− for skipped stops and for a train ending early alike', () => {
    expect(haltChangePictograms(departure([skipped]))).toEqual(['haltMinus']);
    expect(haltChangePictograms(departure([endsEarly]))).toEqual(['haltMinus']);
  });

  it('shows H− once when stops are skipped and the train also ends early', () => {
    expect(haltChangePictograms(departure([skipped, endsEarly]))).toEqual(['haltMinus']);
  });

  it('shows both for a diversion, H+ first whatever order the changes come in', () => {
    expect(haltChangePictograms(departure([skipped, additional]))).toEqual([
      'haltPlus',
      'haltMinus',
    ]);
  });

  it('shows nothing for a train ending here', () => {
    const terminating: TerminatingArrivalEntry = {
      kind: 'terminatingArrival',
      id: 'rb-15645',
      train: { category: 'RB', number: '15645' },
      platform: { planned: '9', actual: '9', changed: false },
      time: { planned, expected: planned },
      status: 'onTime',
      messages: [],
      origin: { name: 'Dieburg' },
    };
    expect(haltChangePictograms(terminating)).toEqual([]);
  });
});
