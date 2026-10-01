import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Root } from './Root';

const openAt = (url: string) => {
  window.history.replaceState(null, '', url);
  return render(<Root />);
};

describe('root page choice', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('starts with the setup page when no display is configured', async () => {
    openAt('/');
    expect(await screen.findByRole('heading', { name: 'Anzeige einrichten' })).toBeDefined();
  });

  it('shows the display once the link carries a configuration', async () => {
    openAt('/?station=8000105&platform=9&provider=mock');
    expect(await screen.findByText('Frankfurt(Main)Hbf')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Anzeige einrichten' })).toBeNull();
  });

  it('keeps the setup page at /setup even with a configuration', async () => {
    openAt('/setup?station=8000105&provider=mock');
    expect(await screen.findByRole('heading', { name: 'Anzeige einrichten' })).toBeDefined();
  });
});
