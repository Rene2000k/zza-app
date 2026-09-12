import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignPreview } from './DesignPreview';
import { previewScenarios } from './scenarios';

describe('design preview', () => {
  it('starts with the first scenario of the first design', () => {
    render(<DesignPreview />);
    expect(screen.getByText('Frankfurt(Main)Hbf')).toBeDefined();
    expect(screen.getByText('Stuttgart Hbf')).toBeDefined();
  });

  it('offers every scenario and switches to the chosen one', () => {
    render(<DesignPreview />);
    const scenarios = screen.getByLabelText(/Szenario/);
    expect(scenarios.querySelectorAll('option')).toHaveLength(previewScenarios.length);

    fireEvent.change(scenarios, { target: { value: 'ausfall' } });
    expect(screen.getByText('FÄLLT AUS')).toBeDefined();

    fireEvent.change(scenarios, { target: { value: 'keine-daten' } });
    expect(screen.getByText('keine Daten')).toBeDefined();
  });

  it('keeps the chosen case in the URL, so it can be shared', () => {
    render(<DesignPreview />);
    fireEvent.change(screen.getByLabelText(/Szenario/), { target: { value: 'gleiswechsel' } });
    expect(window.location.search).toContain('scenario=gleiswechsel');
  });
});
