import { useEffect, useState } from 'react';
import { designIds, findDesign } from '@/designs/registry';
import { DisplayCanvas } from '../DisplayCanvas';
import styles from './DesignPreview.module.css';
import { previewScenarios } from './scenarios';

/**
 * The design playground: any design against any scenario, at `/preview`.
 *
 * It exists so a state nobody can order — a cancellation, a platform change, stale data —
 * can be looked at on demand instead of waited for. It feeds the designs a fixed view model
 * directly, so no provider, no clock and no network take part.
 *
 * The choice is mirrored into the URL, which makes a particular case a link one can send.
 */
export const DesignPreview = () => {
  const [designId, setDesignId] = useState(() => fromQuery('design') ?? designIds()[0] ?? '');
  const [scenarioId, setScenarioId] = useState(
    () => fromQuery('scenario') ?? previewScenarios[0]?.id ?? '',
  );

  const design = findDesign(designId);
  const scenario = previewScenarios.find((candidate) => candidate.id === scenarioId);

  useEffect(() => {
    const query = new URLSearchParams({ design: designId, scenario: scenarioId });
    window.history.replaceState(null, '', `?${query.toString()}`);
  }, [designId, scenarioId]);

  return (
    <main className={styles.page}>
      <div className={styles.controls}>
        <label>
          Design{' '}
          <select value={designId} onChange={(event) => setDesignId(event.target.value)}>
            {designIds().map((id) => (
              <option key={id} value={id}>
                {findDesign(id)?.name ?? id}
              </option>
            ))}
          </select>
        </label>
        <label>
          Szenario{' '}
          <select value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
            {previewScenarios.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        {design !== undefined ? (
          <span className={styles.note}>
            {design.canvas.width} × {design.canvas.height} px
          </span>
        ) : null}
      </div>

      <div className={styles.stage}>
        {design === undefined || scenario === undefined ? (
          <p role="alert">Unbekanntes Design oder Szenario.</p>
        ) : (
          <DisplayCanvas canvas={design.canvas}>
            <design.Component board={scenario.board} />
          </DisplayCanvas>
        )}
      </div>
    </main>
  );
};

const fromQuery = (key: string): string | null =>
  new URLSearchParams(window.location.search).get(key);
