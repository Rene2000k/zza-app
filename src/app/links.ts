/** The setup page next to this display, carrying the current query so the form starts from it. */
export const setupHref = (): string =>
  `${window.location.pathname.replace(/\/?$/, '/')}setup${window.location.search}`;
