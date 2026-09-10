import type { DepartureProvider } from './types';
import { createMockProvider } from './mock';

/**
 * Provider lookup by id.
 *
 * The real source (IRIS, ADR-0002) is added in the API-layer phase; until then the
 * mock is the only entry. The registry exists from the start so nothing above this
 * layer ever imports a provider directly.
 */
const factories: Record<string, () => DepartureProvider> = {
  mock: createMockProvider,
};

export const providerIds = (): string[] => Object.keys(factories);

export const createProvider = (id: string): DepartureProvider => {
  const factory = factories[id];
  if (factory === undefined) {
    throw new Error(`Unknown provider "${id}". Available: ${providerIds().join(', ')}`);
  }
  return factory();
};
