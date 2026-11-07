import { describe, expect, it } from 'vitest';
import { trainNotices } from './trainNotices';
import type { DepartureEntry } from './boardEntry';
import type { RouteChange } from './routeChange';

const time = {
  planned: new Date('2026-09-25T10:20:00Z'),
  expected: new Date('2026-09-25T10:20:00Z'),
};

const departure = (overrides: Partial<DepartureEntry> = {}): DepartureEntry => ({
  kind: 'departure',
  id: '15012',
  train: { category: 'HLB', number: '15012' },
  platform: { planned: '15', actual: '15', changed: false },
  time,
  status: 'onTime',
  messages: [],
  routeChanges: [],
  destination: { name: 'Kassel Hbf' },
  via: [{ name: 'Friedberg(Hess)' }, { name: 'Gießen' }, { name: 'Marburg(Lahn)' }],
  ...overrides,
});

describe('train notices', () => {
  it('has nothing to say about a train running to plan', () => {
    expect(trainNotices(departure(), {})).toEqual({ replacement: false, routeChanges: [] });
  });

  it('identifies a replacement train', () => {
    expect(trainNotices(departure({ status: 'replacement' }), {}).replacement).toBe(true);
  });

  it('announces a cancellation with the source text the source delivered', () => {
    const notices = trainNotices(
      departure({
        status: 'cancelled',
        messages: [
          { kind: 'qualityNotice', topic: 'bicycle', text: 'Keine Fahrradmitnahme' },
          { kind: 'cancellation', code: '80', text: '' },
          { kind: 'cancellation', code: '80', text: 'Fahrt fällt aus' },
        ],
      }),
      {},
    );
    expect(notices.cancellation).toEqual({
      message: { kind: 'cancellation', code: '80', text: 'Fahrt fällt aus' },
    });
  });

  it('announces a cancellation without a text when the source has none', () => {
    const notices = trainNotices(departure({ status: 'cancelled' }), {});
    expect(notices.cancellation).toEqual({});
  });

  it('takes no cancellation message for a train that runs', () => {
    const notices = trainNotices(
      departure({ messages: [{ kind: 'cancellation', text: 'Halt entfällt' }] }),
      {},
    );
    expect(notices.cancellation).toBeUndefined();
  });

  describe('split of a coupled train (ADR-0014)', () => {
    // HLB 15012 and 15112 from Frankfurt(Main)Hbf, 2026-09-25: together to Gießen, then apart.
    const toKassel = departure({ coupledWith: ['15112'] });
    const toSiegen = departure({
      id: '15112',
      train: { category: 'HLB', number: '15112' },
      destination: { name: 'Siegen Hbf' },
      via: [{ name: 'Friedberg(Hess)' }, { name: 'Gießen' }, { name: 'Wetzlar' }],
      coupledWith: ['15012'],
    });

    it('names the stop where the train and its coupled part split', () => {
      expect(trainNotices(toKassel, { coupledPart: toSiegen }).splitStop).toEqual({
        name: 'Gießen',
      });
      expect(trainNotices(toSiegen, { coupledPart: toKassel }).splitStop).toEqual({
        name: 'Gießen',
      });
    });

    it('announces no split for a train without a coupled part', () => {
      expect(trainNotices(toKassel, {}).splitStop).toBeUndefined();
    });

    it('announces no split when the parts share no stop ahead', () => {
      const elsewhere = departure({
        id: '4711',
        destination: { name: 'Fulda' },
        via: [{ name: 'Hanau Hbf' }],
      });
      expect(trainNotices(toKassel, { coupledPart: elsewhere }).splitStop).toBeUndefined();
    });

    it('announces no split when either part does not run', () => {
      const kasselCancelled = departure({ ...toKassel, status: 'cancelled' });
      const siegenCancelled = departure({ ...toSiegen, status: 'cancelled' });
      expect(trainNotices(kasselCancelled, { coupledPart: toSiegen }).splitStop).toBeUndefined();
      expect(trainNotices(toKassel, { coupledPart: siegenCancelled }).splitStop).toBeUndefined();
    });
  });

  describe('platform change (ADR-0006)', () => {
    const movedTo4 = departure({ platform: { planned: '15', actual: '4', changed: true } });

    it('names the platform a train moved to on the display it left', () => {
      expect(trainNotices(movedTo4, { platform: '15' }).movedTo).toBe('4');
    });

    it('names it on a platform display it was never planned at, too', () => {
      expect(trainNotices(movedTo4, { platform: '7' }).movedTo).toBe('4');
    });

    it('leaves a train that changed to this platform as it is', () => {
      expect(trainNotices(movedTo4, { platform: '4' }).movedTo).toBeUndefined();
    });

    it('announces any platform change on a station-wide display', () => {
      expect(trainNotices(movedTo4, {}).movedTo).toBe('4');
    });

    it('announces nothing for a train that keeps its platform', () => {
      expect(trainNotices(departure(), { platform: '7' }).movedTo).toBeUndefined();
      expect(trainNotices(departure(), {}).movedTo).toBeUndefined();
    });
  });

  it('describes how the route differs from the timetable', () => {
    const skipped: RouteChange = { kind: 'skippedStops', stops: [{ name: 'Gießen' }] };
    expect(trainNotices(departure({ routeChanges: [skipped] }), {}).routeChanges).toEqual([
      skipped,
    ]);
  });

  it('has no route changes for a cancelled train, whatever the source says', () => {
    const notices = trainNotices(
      departure({
        status: 'cancelled',
        routeChanges: [{ kind: 'skippedStops', stops: [{ name: 'Gießen' }] }],
      }),
      {},
    );
    expect(notices.routeChanges).toEqual([]);
  });
});
