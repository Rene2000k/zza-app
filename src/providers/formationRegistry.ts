import { createLocalFernbahnProvider } from './fernbahn';
import type { FormationProvider } from './types';

/**
 * The provider for a display that has no Wagenreihungen: it never has one. This is the default —
 * the Wagenstandsanzeiger then shows its idle state.
 */
const createNoFormationProvider = (): FormationProvider => ({
  id: 'none',
  name: 'Keine',
  getFormation: () => Promise.resolve(null),
});

/**
 * Wagenreihung provider lookup by id, the counterpart of the departure registry: the two are
 * configured independently (ADR-0015).
 */
const factories: Record<string, () => FormationProvider> = {
  none: createNoFormationProvider,
  'fernbahn-local': createLocalFernbahnProvider,
};

/**
 * One instance per id for the whole session. The view model asks for its provider on every
 * render, and a provider that keeps what it has read — the local fernbahn file — must not start
 * over each time.
 */
const instances = new Map<string, FormationProvider>();

export const formationProviderIds = (): string[] => Object.keys(factories);

export const createFormationProvider = (id: string): FormationProvider => {
  const existing = instances.get(id);
  if (existing !== undefined) return existing;
  const factory = factories[id];
  if (factory === undefined) {
    throw new Error(
      `Unknown Wagenreihung provider "${id}". Available: ${formationProviderIds().join(', ')}`,
    );
  }
  const provider = factory();
  instances.set(id, provider);
  return provider;
};
