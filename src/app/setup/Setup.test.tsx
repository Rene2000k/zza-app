import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { parseConfig } from '../config';
import { Setup } from './Setup';

const openSetup = (search: string) => {
  window.history.replaceState(null, '', `/setup${search}`);
  return render(<Setup />);
};

const linkValue = (): string => screen.getByLabelText<HTMLInputElement>('Link').value;

describe('setup page', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('turns the form into a display link the display itself accepts', () => {
    openSetup('?provider=mock');
    fireEvent.change(screen.getByLabelText(/Bahnhof/), { target: { value: '8000105' } });
    fireEvent.change(screen.getByLabelText('Gleis'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Design'), { target: { value: 'v3-5x2' } });

    const link = new URL(linkValue());
    expect(link.pathname).toBe('/');
    const result = parseConfig(link.search);
    expect(result.ok && result.config).toMatchObject({
      station: '8000105',
      platform: '9',
      design: 'v3-5x2',
      provider: 'mock',
    });
    expect(screen.getByText('Anzeige öffnen').getAttribute('href')).toBe(linkValue());
  });

  it('starts from the query it was opened with', () => {
    openSetup('?station=8000207&platform=4&design=v3-5x2&provider=mock&refreshSeconds=60');
    expect(screen.getByLabelText<HTMLInputElement>(/Bahnhof/).value).toBe('8000207');
    expect(screen.getByLabelText<HTMLInputElement>('Gleis').value).toBe('4');
    expect(screen.getByLabelText<HTMLInputElement>(/Abrufintervall/).value).toBe('60');
    expect(linkValue()).toContain('refreshSeconds=60');
  });

  it('leaves the platform out of the link when none is chosen', () => {
    openSetup('?station=8000105&provider=mock');
    expect(linkValue()).not.toContain('platform=');
  });

  it('names what is missing instead of offering a link', () => {
    openSetup('?provider=mock');
    expect(screen.queryByLabelText('Link')).toBeNull();
    expect(screen.getByText(/muss eine EVA-Nummer/)).toBeDefined();

    fireEvent.change(screen.getByLabelText(/Bahnhof/), { target: { value: '8000105' } });
    fireEvent.change(screen.getByLabelText(/Abrufintervall/), { target: { value: '5' } });
    expect(screen.queryByLabelText('Link')).toBeNull();
    expect(screen.getByText(/refreshSeconds/)).toBeDefined();
  });

  it('confirms the station by name and offers its platforms', async () => {
    openSetup('?station=8000760&provider=mock');
    expect(await screen.findByText('Bad Vilbel')).toBeDefined();
    const offered = document.querySelectorAll('#setup-platforms option');
    expect([...offered].map((option) => option.getAttribute('value'))).toEqual(['1', '2', '3']);
  });

  it('offers platforms in their natural order', async () => {
    openSetup('?station=8000105&provider=mock');
    expect(await screen.findByText('Frankfurt(Main)Hbf')).toBeDefined();
    const offered = [...document.querySelectorAll('#setup-platforms option')].map((option) =>
      option.getAttribute('value'),
    );
    expect(offered.slice(0, 4)).toEqual(['1', '1a', '2', '3']);
    expect(offered.indexOf('10')).toBeGreaterThan(offered.indexOf('9'));
  });

  it('says so when no station is known under the number', async () => {
    openSetup('?station=1234567&provider=mock');
    expect(await screen.findByText(/kein Bahnhof bekannt/)).toBeDefined();
  });

  it('keeps the path the page is served under', () => {
    window.history.replaceState(null, '', '/zza/setup?station=8000105&provider=mock');
    render(<Setup />);
    expect(new URL(linkValue()).pathname).toBe('/zza/');
  });
});
