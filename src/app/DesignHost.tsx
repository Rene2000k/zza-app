import { findDesign } from '@/designs/registry';
import { useZzaBoard } from '@/hooks/useZzaBoard';
import { DisplayCanvas } from './DisplayCanvas';
import type { DisplayConfig } from './config';

export interface DesignHostProps {
  readonly config: DisplayConfig;
}

/**
 * Runs one configured display: the view model comes from the hook, the design from the
 * registry, the scaling from the canvas. Nothing here knows which design it is showing,
 * which is the whole point — a new design is a registry entry, not a change to this file.
 */
export const DesignHost = ({ config }: DesignHostProps) => {
  const board = useZzaBoard(config);
  const design = findDesign(config.design);

  if (design === undefined) {
    // The configuration is checked against the registry before it gets here, so this is a
    // last line of defence rather than the normal path for a wrong id.
    return <p role="alert">Unbekanntes Design „{config.design}“.</p>;
  }

  return (
    <DisplayCanvas canvas={design.canvas}>
      <design.Component board={board} />
    </DisplayCanvas>
  );
};
