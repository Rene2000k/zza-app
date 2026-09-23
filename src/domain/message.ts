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
  | 'constraint'
  /** Something about the train itself falls short of what was promised. */
  | 'qualityNotice';

/**
 * What a quality notice is about (ADR-0011).
 *
 * The source states only a code; the provider files each code under one of these subjects,
 * and a design names the subjects it shows. That keeps the code numbers inside the provider
 * and the choice of what reaches a screen inside the design — neither knows the other.
 */
export type QualityTopic =
  /** Coaches run in a different order than usual — including where a class or section sits. */
  | 'coachOrder'
  /** The train runs short of coaches. */
  | 'missingCoaches'
  /** Carrying a bicycle is not possible, or not guaranteed. */
  | 'bicycle'
  /** No or reduced catering on board. */
  | 'catering'
  /** A missing toilet, boarding aid or other accessible facility. */
  | 'accessibility'
  /** WLAN and on-board entertainment. */
  | 'onboardServices'
  /** Reservations do not apply, in the whole train or in single coaches. */
  | 'reservation'
  /** The train is full, or boarding cannot be guaranteed. */
  | 'occupancy'
  /** A bus runs instead of the train. */
  | 'busReplacement'
  /** Named as a shortcoming by the source, without a subject of its own. */
  | 'other';

/** Every kind except a quality notice; only those carry a topic. */
export type PlainMessageKind = Exclude<MessageKind, 'qualityNotice'>;

interface MessageFields {
  /** Source code, kept for diagnostics even when a text was resolved. */
  readonly code?: string;
  /** Resolved text, if the project knows this code. Undefined means "do not display". */
  readonly text?: string;
  /** Lower numbers are more important, following the source's own convention. */
  readonly priority?: number;
}

/**
 * A quality notice always states its subject — a notice the provider could not file under
 * one is not produced at all, so a design can rely on the topic being there.
 */
export interface QualityMessage extends MessageFields {
  readonly kind: 'qualityNotice';
  readonly topic: QualityTopic;
}

export interface PlainMessage extends MessageFields {
  readonly kind: PlainMessageKind;
}

export type BoardMessage = PlainMessage | QualityMessage;

/** Messages worth showing: those the project could turn into text. */
export const displayableMessages = (messages: readonly BoardMessage[]): BoardMessage[] =>
  messages.filter((message) => message.text !== undefined && message.text.trim() !== '');
