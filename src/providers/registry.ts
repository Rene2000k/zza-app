import type { DepartureProvider } from './types';
import { createIrisProvider } from './iris';
import { createMockProvider } from './mock';

/**
 * Provider lookup by id.
 *
 * The registry exists from the start so nothing above this layer ever imports a
 * provider directly.
 */
const factories: Record<string, () => DepartureProvider> = {
  mock: createMockProvider,
  iris: createIrisProvider,
};

export const providerIds = (): string[] => Object.keys(factories);

export const createProvider = (id: string): DepartureProvider => {
  const factory = factories[id];
  if (factory === undefined) {
    throw new Error(`Unknown provider "${id}". Available: ${providerIds().join(', ')}`);
  }
  return factory();
};
