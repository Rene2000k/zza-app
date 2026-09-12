import { Suspense, lazy } from 'react';
import { App } from './App';

// A development page, loaded on demand so it stays out of the display's own bundle.
const ComponentGallery = lazy(() =>
  import('./gallery/ComponentGallery').then((module) => ({ default: module.ComponentGallery })),
);

/** Picks the page by path: the component gallery at `/gallery`, the display everywhere else. */
export const Root = () => {
  const isGallery =
    window.location.pathname.split('/').findLast((segment) => segment !== '') === 'gallery';

  if (!isGallery) return <App />;
  return (
    <Suspense fallback={null}>
      <ComponentGallery />
    </Suspense>
  );
};
