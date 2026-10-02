/**
 * A single-letter shortcut on the display: the plain key, no modifier, and not while
 * someone is typing into a field — "f" in a platform label must not toggle fullscreen.
 */
export const isShortcut = (event: KeyboardEvent, key: string): boolean =>
  event.key.toLowerCase() === key &&
  !event.ctrlKey &&
  !event.metaKey &&
  !event.altKey &&
  !isEditable(event.target);

const isEditable = (target: EventTarget | null): boolean =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement ||
  (target instanceof HTMLElement && target.isContentEditable);
