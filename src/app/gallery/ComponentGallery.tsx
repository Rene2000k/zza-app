import {
  FittedText,
  Marquee,
  Pictogram,
  Ticker,
  TrainFormationDisplay,
  formatClockTime,
  formatDelay,
} from '@/components/zza';
import styles from './ComponentGallery.module.css';
import type { ReactNode } from 'react';
import type { EntryTime } from '@/domain/boardEntry';
import type { TrainFormation } from '@/domain/formation';
import type { BoardMessage } from '@/domain/message';

/**
 * Development page for what all displays share. Reached at `/gallery`.
 *
 * Only the shared parts belong here: the blocks that own a mechanism of their own, and the
 * formatters a design uses to build its fields (ADR-0009). What a design decides — which
 * statement a field makes, its wording, its layout — is reviewed with that design instead.
 *
 * Each sample sits in a frame standing in for a design's slot: the dashed outline shows
 * where a block clips, and the inverted frame shows that a block takes its colours from its
 * surroundings rather than bringing its own.
 */
export const ComponentGallery = () => (
  <main className={styles.gallery}>
    <h1>Gemeinsame Bausteine</h1>
    <p>
      Was jedes Design benutzt, ohne es nachzubauen. Alles, was ein Anzeigertyp selbst entscheidet,
      steht nicht hier, sondern beim Design.
    </p>

    {blocks.map((block) => (
      <section key={block.name} className={styles.section}>
        <h2>{block.name}</h2>
        <p>{block.summary}</p>
        <div className={styles.samples}>
          {block.samples.map((sample) => (
            <figure key={sample.label} className={styles.sample}>
              <div
                className={sample.invert === true ? styles.frameInverted : styles.frame}
                style={{ width: sample.width, height: sample.height }}
              >
                {sample.content}
              </div>
              <figcaption className={styles.caption}>{sample.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    ))}

    <section className={styles.section}>
      <h2>Formatierer</h2>
      <p>
        Reine Funktionen ohne React. Sie liefern die Fakten; welche davon ein Feld druckt,
        entscheidet das Design — V3 5X2 zeigt „+12“, V4 5X2 an derselben Stelle die Ist-Zeit.
      </p>
      <table>
        <thead>
          <tr>
            <th>Aufruf</th>
            <th>Ergebnis</th>
          </tr>
        </thead>
        <tbody>
          {formatterRows.map(([call, result]) => (
            <tr key={call}>
              <td>{call}</td>
              <td>{result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  </main>
);

interface Sample {
  readonly label: string;
  readonly content: ReactNode;
  /** Slot size; omitted means the frame shrinks to the block. */
  readonly width?: string;
  readonly height?: string;
  /** Light ground with dark text, as a design would set it. */
  readonly invert?: boolean;
}

interface BlockSection {
  /** The block's export name — the gallery test checks that none is missing. */
  readonly name: string;
  readonly summary: string;
  readonly samples: readonly Sample[];
}

const planned = new Date('2026-09-11T10:52:00+02:00');
const onTime: EntryTime = { planned, expected: planned };
const delayed: EntryTime = { planned, expected: new Date(planned.getTime() + 12 * 60_000) };

const messages: readonly BoardMessage[] = [
  { kind: 'delayCause', code: '43', text: 'Verspätung eines vorausfahrenden Zuges' },
  { kind: 'delayCause', code: '9999' },
  { kind: 'info', text: 'Heute ohne Halt in Weinheim' },
];

/** Invented, since no source delivers formations — only to show the block's populated state. */
const formation: TrainFormation = {
  sections: ['A', 'B', 'C', 'D'],
  coaches: [
    { number: '11', travelClass: 'first', features: [] },
    { number: '12', travelClass: 'first', features: [] },
    { number: '13', travelClass: 'none', features: ['dining'] },
    { number: '14', travelClass: 'second', features: [] },
    { number: '15', travelClass: 'second', features: ['bicycles'] },
  ],
  accuracy: 'scheduled',
};

const blocks: readonly BlockSection[] = [
  {
    name: 'FittedText',
    summary:
      'Staucht zu breiten Text, statt ihn abzuschneiden — was ein echter Anzeiger mit einem langen Ortsnamen tut. Unter einer Mindestbreite hört das Stauchen auf.',
    samples: [
      { label: 'passt', content: <FittedText>Gießen</FittedText>, width: '12em' },
      {
        label: 'zu breit, wird gestaucht',
        content: <FittedText>Frankfurt(M) Flughafen Fernbf</FittedText>,
        width: '12em',
      },
    ],
  },
  {
    name: 'Marquee',
    summary:
      'Läuft nur, wenn der Inhalt breiter ist als sein Feld; die zweite Kopie macht den Umlauf nahtlos.',
    samples: [
      { label: 'kurz — steht', content: <Marquee>kurze Meldung</Marquee>, width: '20em' },
      {
        label: 'lang — läuft',
        content: (
          <Marquee>Diese Meldung ist deutlich länger als ihr Feld und läuft deshalb um</Marquee>
        ),
        width: '20em',
      },
    ],
  },
  {
    name: 'Pictogram',
    summary:
      'Piktogramme der echten Anzeiger als Vektorzeichnung, gewählt über eine ID. Eine em hoch, in der Farbe der Umgebung; welche eine Halteänderung bekommt, sagt haltChangePictograms.',
    samples: [
      { label: 'haltPlus', content: <Pictogram id="haltPlus" /> },
      { label: 'haltMinus', content: <Pictogram id="haltMinus" /> },
      {
        label: 'Umleitung: beide, H+ zuerst',
        content: (
          <>
            <Pictogram id="haltPlus" /> <Pictogram id="haltMinus" />
          </>
        ),
      },
      { label: 'invertiert', content: <Pictogram id="haltPlus" />, invert: true },
    ],
  },
  {
    name: 'Ticker',
    summary:
      'Meldungszeile. Ein Code ohne Text entfällt, statt als Zahl zu erscheinen; die Bewegung folgt mit der Laufschrift-Mechanik.',
    samples: [
      {
        label: 'zwei Meldungen, ein unbekannter Code',
        content: <Ticker messages={messages} />,
        width: '24em',
      },
      {
        label: 'invertiert, Trenner +++',
        content: <Ticker messages={messages} separator=" +++ " />,
        width: '24em',
        invert: true,
      },
      {
        label: 'nur unbekannte Codes (leer)',
        content: <Ticker messages={[{ kind: 'delayCause', code: '9999' }]} />,
        width: '24em',
        height: '1.4em',
      },
    ],
  },
  {
    name: 'TrainFormationDisplay',
    summary:
      'Wagenband mit Abschnittsleiste. Ohne Daten der definierte Ruhezustand — das ist der Normalfall, weil keine freie Quelle Wagenreihungen liefert.',
    samples: [
      {
        label: 'keine Daten (Normalfall)',
        content: <TrainFormationDisplay formation={undefined} />,
        width: '9em',
      },
      {
        label: 'mit Reihung (erfunden)',
        content: <TrainFormationDisplay formation={formation} />,
        width: '9em',
      },
    ],
  },
];

const formatterRows: readonly (readonly [string, string])[] = [
  ['formatClockTime(time.planned)', formatClockTime(onTime.planned)],
  ['formatClockTime(time.expected)', formatClockTime(delayed.expected)],
  ['formatDelay(time)', formatDelay(delayed) ?? '(nichts)'],
  ['formatDelay(time) — pünktlich', formatDelay(onTime) ?? '(nichts)'],
];
