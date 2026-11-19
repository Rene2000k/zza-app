import type { FormationProvider } from './types';

/**
 * The provider for a display that has no Wagenreihungen: it never has one. This is the default,
 * since no provider currently delivers them — the Wagenstandsanzeiger then shows its idle state.
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
};

export const formationProviderIds = (): string[] => Object.keys(factories);

export const createFormationProvider = (id: string): FormationProvider => {
  const factory = factories[id];
  if (factory === undefined) {
    throw new Error(
      `Unknown Wagenreihung provider "${id}". Available: ${formationProviderIds().join(', ')}`,
    );
  }
  return factory();
};
