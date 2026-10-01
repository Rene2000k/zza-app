import { Suspense, lazy } from 'react';
import { App } from './App';
import type { ReactNode } from 'react';

// Development pages, loaded on demand so they stay out of the display's own bundle.
const ComponentGallery = lazy(() =>
  import('./gallery/ComponentGallery').then((module) => ({ default: module.ComponentGallery })),
);
const DesignPreview = lazy(() =>
  import('./preview/DesignPreview').then((module) => ({ default: module.DesignPreview })),
);
// Not a development page, but loaded on demand for the same reason: a display never needs it.
const Setup = lazy(() => import('./setup/Setup').then((module) => ({ default: module.Setup })));

/**
 * Picks the page by path: the block gallery at `/gallery`, the design playground at
 * `/preview`, the setup form at `/setup`, the configured display everywhere else.
 *
 * A display is its query, so without one there is nothing to show yet — the start page is
 * then the setup form, which produces exactly such a query.
 */
export const Root = () => {
  const page = window.location.pathname.split('/').findLast((segment) => segment !== '');

  if (page === 'gallery') return withFallback(<ComponentGallery />);
  if (page === 'preview') return withFallback(<DesignPreview />);
  if (page === 'setup' || window.location.search === '') return withFallback(<Setup />);
  return <App />;
};

const withFallback = (page: ReactNode) => <Suspense fallback={null}>{page}</Suspense>;
