/**
 * A message attached to a board entry — the material for the scrolling line.
 *
 * The chosen data source delivers reasons as numeric codes without any text
 * (see ADR-0002), so a message carries its code and, where the project can resolve
 * it, a text. An unresolved code must render as nothing rather than as a number.
 */
export type MessageKind =
  /** Cause of a delay. */
  | 'delayCause'
  /** The train, or this stop, is cancelled. */
  | 'cancellation'
  /** General information, no disruption. */
  | 'info'
  /** Disruption notice. */
  | 'disruption'
  /** Operational constraint (e.g. reduced capacity). */
  | 'constraint';

export interface BoardMessage {
  readonly kind: MessageKind;
  /** Source code, kept for diagnostics even when a text was resolved. */
  readonly code?: string;
  /** Resolved text, if the project knows this code. Undefined means "do not display". */
  readonly text?: string;
  /** Lower numbers are more important, following the source's own convention. */
  readonly priority?: number;
}

/** Messages worth showing: those the project could turn into text. */
export const displayableMessages = (messages: readonly BoardMessage[]): BoardMessage[] =>
  messages.filter((message) => message.text !== undefined && message.text.trim() !== '');
