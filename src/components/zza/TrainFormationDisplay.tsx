import styles from './zza.module.css';
import type { Coach, CoachClass, TrainFormation } from '@/domain/formation';

export interface TrainFormationDisplayProps {
  /** Undefined when no source has the coach sequence — which is currently always the case. */
  readonly formation: TrainFormation | undefined;
}

/**
 * Coach-position display: the platform's section letters above, the coaches below, front
 * first.
 *
 * The section scale belongs to this block rather than standing alone, because on the
 * reference displays the letters exist only as the ruler for the coach strip.
 *
 * Without a formation it shows its defined idle state — an empty coach strip, as real
 * displays do — never an error: the coach sequence must not become a hard dependency of
 * the departure display. Coach features are carried as data but not drawn yet; they need
 * pictograms, not text.
 */
export const TrainFormationDisplay = ({ formation }: TrainFormationDisplayProps) => {
  if (formation === undefined) {
    return (
      <div className={styles.formation} data-state="idle">
        <div className={styles.coaches}>
          <span className={styles.coach}>{NO_TEXT}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formation} data-state="formation">
      <div className={styles.sections}>
        {formation.sections.map((section) => (
          <span key={section}>{section}</span>
        ))}
      </div>
      <div className={styles.coaches}>
        {formation.coaches.map((coach, position) => (
          <span
            // A coach's place in the train is its identity here; unnumbered coaches have
            // nothing else, and a formation is replaced whole, never reordered in place.
            key={coach.number ?? `position-${position}`}
            className={styles.coach}
            data-features={coach.features.join(' ')}
          >
            {classLabel(coach)}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Keeps an empty cell one text line tall without a size literal. */
const NO_TEXT = ' ';

const classLabels: Record<CoachClass, string> = {
  first: '1',
  second: '2',
  mixed: '1/2',
  none: NO_TEXT,
};

const classLabel = (coach: Coach): string => classLabels[coach.travelClass];
