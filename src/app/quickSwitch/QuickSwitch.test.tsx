import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuickSwitch } from './QuickSwitch';
import { displayConfigSchema, parseConfig } from '../config';

const config = displayConfigSchema.parse({
  station: '8000105',
  platform: '9',
  design: 'v3-5x2',
  provider: 'mock',
  refreshSeconds: 60,
  simulatedTime: '2026-09-09T08:00:00+02:00',
});

const setup = () => {
  const navigate = vi.fn<(search: string) => void>();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <QuickSwitch config={config} navigate={navigate} />
    </QueryClientProvider>,
  );
  return { navigate };
};

const openPanel = () => fireEvent.click(screen.getByRole('button', { name: 'Schnellwechsel' }));
const panel = () => screen.queryByRole('complementary', { name: 'Schnellwechsel' });

describe('quick switch', () => {
  it('opens from the menu button with the configuration on screen', () => {
    setup();
    expect(panel()).toBeNull();

    openPanel();
    expect(panel()).not.toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(/Bahnhof/).value).toBe('8000105');
    expect(screen.getByLabelText<HTMLInputElement>('Gleis').value).toBe('9');
    expect(screen.getByLabelText<HTMLSelectElement>('Design').value).toBe('v3-5x2');
    expect(screen.getByLabelText<HTMLSelectElement>('Datenquelle').value).toBe('mock');
  });

  it('offers no switch until something changed', () => {
    setup();
    openPanel();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Wechseln' }).disabled).toBe(true);
  });

  it('loads the new choice and keeps the rest of the link', () => {
    const { navigate } = setup();
    openPanel();
    fireEvent.change(screen.getByLabelText('Gleis'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Design'), { target: { value: 'debug' } });
    fireEvent.click(screen.getByRole('button', { name: 'Wechseln' }));

    expect(navigate).toHaveBeenCalledOnce();
    const result = parseConfig(navigate.mock.calls[0]?.[0] ?? '');
    expect(result.ok && result.config).toMatchObject({
      station: '8000105',
      platform: '4',
      design: 'debug',
      refreshSeconds: 60,
      simulatedTime: '2026-09-09T08:00:00+02:00',
    });
  });

  it('switches to the whole station when the platform is cleared', () => {
    const { navigate } = setup();
    openPanel();
    fireEvent.change(screen.getByLabelText('Gleis'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Wechseln' }));
    expect(navigate.mock.calls[0]?.[0]).not.toContain('platform=');
  });

  it('names the problem instead of switching to a broken configuration', () => {
    const { navigate } = setup();
    openPanel();
    fireEvent.change(screen.getByLabelText(/Bahnhof/), { target: { value: '80001' } });

    expect(screen.getByText(/muss eine EVA-Nummer/)).toBeDefined();
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Wechseln' });
    expect(submit.disabled).toBe(true);
    fireEvent.submit(submit);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('closes on Escape and on "Abbrechen", and starts afresh when reopened', () => {
    setup();
    openPanel();
    fireEvent.change(screen.getByLabelText('Gleis'), { target: { value: '4' } });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(panel()).toBeNull();

    openPanel();
    expect(screen.getByLabelText<HTMLInputElement>('Gleis').value).toBe('9');
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(panel()).toBeNull();
  });
});
