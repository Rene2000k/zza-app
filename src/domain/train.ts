/**
 * How a train is named on the display.
 *
 * The three parts are kept apart because designs use them differently: some show
 * "ICE 571", some show the line label "RE 60", some show a category pictogram plus
 * the number.
 */
export interface TrainRef {
  /** Product category as printed: "ICE", "IC", "RE", "RB", "S", "NX"… */
  readonly category: string;
  /** Train number without the category, e.g. "571". */
  readonly number: string;
  /** Line label where one exists, e.g. "RE60", "S8". Long-distance trains have none. */
  readonly line?: string;
  /** Operator code from the source; useful for non-DB operators. */
  readonly operator?: string;
}

/** "ICE 571" — the plainest rendering, for fallbacks and debug views. */
export const formatTrainRef = (train: TrainRef): string =>
  `${train.category} ${train.number}`.trim();
