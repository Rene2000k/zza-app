import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchChanges, fetchPlan, fetchStation } from './client';

const xmlResponse = (body: string, ok = true): Response =>
  new Response(body, { status: ok ? 200 : 403, statusText: ok ? 'OK' : 'Forbidden' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchPlan', () => {
  it('requests the eva/date/hour path and parses the XML body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xmlResponse("<timetable station='X'></timetable>"));
    vi.stubGlobal('fetch', fetchMock);

    const doc = await fetchPlan('8000105', { yymmdd: '260910', hh: '16' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://iris.noncd.db.de/iris-tts/timetable/plan/8000105/260910/16',
      {},
    );
    expect(doc.documentElement.getAttribute('station')).toBe('X');
  });
});

describe('fetchChanges', () => {
  it('requests the fchg path for the given eva', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xmlResponse('<timetable station="X" eva="8000105"></timetable>'));
    vi.stubGlobal('fetch', fetchMock);

    await fetchChanges('8000105');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://iris.noncd.db.de/iris-tts/timetable/fchg/8000105',
      {},
    );
  });
});

describe('fetchStation', () => {
  it('URL-encodes a query containing parentheses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xmlResponse('<stations></stations>'));
    vi.stubGlobal('fetch', fetchMock);

    await fetchStation('Frankfurt(Main)Hbf');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://iris.noncd.db.de/iris-tts/timetable/station/Frankfurt(Main)Hbf',
      {},
    );
  });

  it('passes an AbortSignal through when given one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(xmlResponse('<stations></stations>'));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await fetchStation('FF', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), { signal: controller.signal });
  });
});

describe('error handling', () => {
  it('throws on a non-OK response instead of returning a document', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(xmlResponse('Request Rejected', false)));
    await expect(fetchStation('FF')).rejects.toThrow(/403/);
  });

  it('throws when the body is not valid XML — the ADR-0002 "Request Rejected" failure mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(xmlResponse('<html>Request Rejected</html>Request Rejected')));
    await expect(fetchStation('FF')).rejects.toThrow(/XML/);
  });
});
