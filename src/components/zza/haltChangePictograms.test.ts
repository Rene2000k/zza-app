import { describe, expect, it } from 'vitest';
import { haltChangePictograms } from './haltChangePictograms';
import type { RouteChange } from '@/domain/routeChange';

const skipped: RouteChange = { kind: 'skippedStops', stops: [{ name: 'Göttingen' }] };
const endsEarly: RouteChange = { kind: 'endsEarly', stops: [{ name: 'Hamburg-Altona' }] };
const additional: RouteChange = { kind: 'additionalStops', stops: [{ name: 'Hamburg-Harburg' }] };

describe('haltChangePictograms', () => {
  it('shows nothing for a train on its timetabled route', () => {
    expect(haltChangePictograms([])).toEqual([]);
  });

  it('shows H+ for additional stops', () => {
    expect(haltChangePictograms([additional])).toEqual(['haltPlus']);
  });

  it('shows H− for skipped stops and for a train ending early alike', () => {
    expect(haltChangePictograms([skipped])).toEqual(['haltMinus']);
    expect(haltChangePictograms([endsEarly])).toEqual(['haltMinus']);
  });

  it('shows H− once when stops are skipped and the train also ends early', () => {
    expect(haltChangePictograms([skipped, endsEarly])).toEqual(['haltMinus']);
  });

  it('shows both for a diversion, H+ first whatever order the changes come in', () => {
    expect(haltChangePictograms([skipped, additional])).toEqual(['haltPlus', 'haltMinus']);
  });
});
