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
 * Picks the page by path: the setup form at `/setup`, the block gallery at `/gallery`, the
 * design playground at `/preview`, the configured display everywhere else.
 */
export const Root = () => {
  const page = window.location.pathname.split('/').findLast((segment) => segment !== '');

  if (page === 'setup') return withFallback(<Setup />);
  if (page === 'gallery') return withFallback(<ComponentGallery />);
  if (page === 'preview') return withFallback(<DesignPreview />);
  return <App />;
};

const withFallback = (page: ReactNode) => <Suspense fallback={null}>{page}</Suspense>;
