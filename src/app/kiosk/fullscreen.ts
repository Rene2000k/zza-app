import { isShortcut } from '../shortcuts';

/**
 * Switches the whole page into fullscreen and back.
 *
 * Browsers allow this only in answer to a user gesture, so it is bound to a key and a
 * double-click rather than done on load. A kiosk browser started in fullscreen does not
 * need it at all. A refused request leaves the display as it is.
 */
export const toggleFullscreen = (): void => {
  const request =
    document.fullscreenElement === null
      ? document.documentElement.requestFullscreen()
      : document.exitFullscreen();
  request.catch(() => undefined);
};

/** The key that toggles fullscreen — "f", as in video players. */
export const isFullscreenKey = (event: KeyboardEvent): boolean => isShortcut(event, 'f');
