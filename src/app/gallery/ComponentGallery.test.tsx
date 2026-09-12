import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as shared from '@/components/zza';
import { ComponentGallery } from './ComponentGallery';

/** Components are the exports starting with a capital; the rest are formatters. */
const blockNames = Object.keys(shared).filter((name) => /^[A-Z]/.test(name));

describe('component gallery', () => {
  it('shows every shared block, so a new one cannot be forgotten', () => {
    render(<ComponentGallery />);
    for (const name of blockNames) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeDefined();
    }
  });

  it('shows what the formatters produce, including the empty case', () => {
    render(<ComponentGallery />);
    expect(screen.getByRole('heading', { level: 2, name: 'Formatierer' })).toBeDefined();
    expect(screen.getByText('+12')).toBeDefined();
    expect(screen.getByText('11:04')).toBeDefined();
  });
});
