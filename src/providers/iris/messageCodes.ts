import type { QualityTopic } from '@/domain/message';

/**
 * Message code → German text, in two tables: delay causes and quality notices.
 *
 * IRIS reports both as a bare numeric code (`<m t="d" c="43"/>`, `<m t="q" c="85"/>`),
 * never as text (ADR-0002). These tables are this project's own translation, since the
 * source carries none. The codes and wording are cross-checked against the
 * community-maintained table in derf/Travel-Status-DE-IRIS
 * (github.com/derf/Travel-Status-DE-IRIS, lib/Travel/Status/DE/IRIS/Result.pm), itself
 * reconciled against a DB-published list — not an official Deutsche Bahn source, but the
 * closest available.
 */

/**
 * Delay-cause code → German text.
 *
 * A code missing here must resolve to `undefined` — see `resolveDelayCause` and the domain
 * rule in `displayableMessages`.
 */
export const delayCauseCodes: ReadonlyMap<string, string> = new Map(
  Object.entries({
    '1': 'Nähere Informationen in Kürze',
    '2': 'Polizeieinsatz',
    '3': 'Feuerwehreinsatz auf der Strecke',
    '4': 'Kurzfristiger Personalausfall',
    '5': 'Ärztliche Versorgung eines Fahrgastes',
    '6': 'Unbefugtes Ziehen der Notbremse',
    '7': 'Unbefugte Personen auf der Strecke',
    '8': 'Notarzteinsatz auf der Strecke',
    '9': 'Streikauswirkungen',
    '10': 'Tiere auf der Strecke',
    '11': 'Unwetter',
    '12': 'Warten auf ein verspätetes Schiff',
    '13': 'Pass- und Zollkontrolle',
    '14': 'Technischer Defekt am Bahnhof',
    '15': 'Beeinträchtigung durch Vandalismus',
    '16': 'Entschärfung einer Fliegerbombe',
    '17': 'Beschädigung einer Brücke',
    '18': 'Umgestürzter Baum auf der Strecke',
    '19': 'Unfall an einem Bahnübergang',
    '20': 'Tiere im Gleis',
    '21': 'Warten auf Anschlussreisende',
    '22': 'Witterungsbedingte Beeinträchtigungen',
    '23': 'Betriebsstabilisierung',
    '24': 'Verspätung im Ausland',
    '25': 'Bereitstellung weiterer Wagen',
    '26': 'Abhängen von Wagen',
    '27': 'Technische Störung am Bus',
    '28': 'Gegenstände auf der Strecke',
    '29': 'Ersatzverkehr mit Bus ist eingerichtet',
    '30': 'Personalausfall im Stellwerk',
    '31': 'Bauarbeiten',
    '32': 'Längere Haltezeit am Bahnhof',
    '33': 'Reparatur an der Oberleitung',
    '34': 'Reparatur an einem Signal',
    '35': 'Streckensperrung',
    '36': 'Technische Störung am Zug',
    '37': 'Kurzfristiger Fahrzeugausfall',
    '38': 'Reparatur an der Strecke',
    '39': 'Stau / Hohes Verkehrsaufkommen',
    '40': 'Defektes Stellwerk',
    '41': 'Technischer Defekt an einem Bahnübergang',
    '42': 'Vorübergehend verminderte Geschwindigkeit auf der Strecke',
    '43': 'Verspätung eines vorausfahrenden Zuges',
    '44': 'Warten auf einen entgegenkommenden Zug',
    '45': 'Vorfahrt eines anderen Zuges',
    '46': 'Vorfahrt eines anderen Zuges',
    '47': 'Verspätete Bereitstellung',
    '48': 'Verspätung aus vorheriger Fahrt',
    '49': 'Kurzfristiger Personalausfall',
    '50': 'Kurzfristige Erkrankung von Personal',
    '51': 'Verspätetes Personal aus vorheriger Fahrt',
    '52': 'Streik',
    '53': 'Unwetterauswirkungen',
    '54': 'Verfügbarkeit der Gleise derzeit eingeschränkt',
    '55': 'Technischer Defekt an einem anderen Zug',
    '56': 'Laden der Antriebsbatterie',
    '57': 'Zusätzlicher Halt zum Ein- und Ausstieg',
    '58': 'Umleitung des Zuges',
    '59': 'Schnee und Eis',
    '60': 'Witterungsbedingt verminderte Geschwindigkeit',
    '61': 'Defekte Tür',
    '62': 'Behobener Defekt am Zug',
    '63': 'Technische Untersuchung am Zug',
    '64': 'Defekt an einer Weiche',
    '65': 'Erdrutsch',
    '66': 'Hochwasser',
    '67': 'Behördliche Maßnahme',
    '68': 'Hohes Fahrgastaufkommen verlängert Ein- und Ausstieg',
    '69': 'Zug verkehrt mit verminderter Geschwindigkeit',
    '99': 'Verzögerungen im Betriebsablauf',
  }),
);

/** A code this table does not know must render as nothing, never as the bare number. */
export const resolveDelayCause = (code: string): string | undefined => delayCauseCodes.get(code);

export interface QualityCode {
  readonly text: string;
  readonly topic: QualityTopic;
}

const quality = (topic: QualityTopic, text: string): QualityCode => ({ topic, text });

/**
 * Quality code → text and topic (ADR-0011).
 *
 * The topic is this project's classification, not something the source publishes: IRIS
 * states a code and nothing else.
 *
 * Codes 84, 88 and 89 are deliberately absent — see `revokingCodes` below.
 */
export const qualityCodes: ReadonlyMap<string, QualityCode> = new Map(
  Object.entries({
    '70': quality('onboardServices', 'WLAN nicht verfügbar'),
    '71': quality('onboardServices', 'Eingeschränktes WLAN'),
    '72': quality('onboardServices', 'Info-/Entertainmentprogramm nicht verfügbar'),
    '73': quality('coachOrder', 'Heute: Mehrzweckabteil vorne'),
    '74': quality('coachOrder', 'Heute: Mehrzweckabteil hinten'),
    '75': quality('coachOrder', 'Heute: 1. Klasse vorne'),
    '76': quality('coachOrder', 'Heute: 1. Klasse hinten'),
    '77': quality('missingCoaches', '1. Klasse fehlt'),
    '78': quality('busReplacement', 'Ersatzverkehr mit Bus ist eingerichtet'),
    '79': quality('missingCoaches', 'Mehrzweckabteil fehlt'),
    '80': quality('coachOrder', 'Abweichende Wagenreihung'),
    '81': quality('coachOrder', 'Fahrzeugtausch'),
    '82': quality('missingCoaches', 'Mehrere Wagen fehlen'),
    '83': quality('accessibility', 'Heute ohne fahrzeuggebundene Einstiegshilfe'),
    '85': quality('missingCoaches', 'Ein Wagen fehlt'),
    '86': quality('reservation', 'Gesamter Zug ohne Reservierung'),
    '87': quality('reservation', 'Einzelne Wagen ohne Reservierung'),
    '90': quality('catering', 'Kein gastronomisches Angebot'),
    '91': quality('bicycle', 'Fahrradmitnahme nicht möglich'),
    '92': quality('bicycle', 'Fahrradmitnahme kann nicht garantiert werden'),
    '93': quality('accessibility', 'Behindertengerechte Einrichtung fehlt'),
    '94': quality('catering', 'Ersatzbewirtschaftung'),
    '95': quality('accessibility', 'Universaltoilette fehlt'),
    '96': quality('occupancy', 'Zustieg kann nicht garantiert werden'),
    '97': quality('occupancy', 'Hohe Auslastung'),
    '98': quality('other', 'Sonstige Qualitätsmängel'),
    '99': quality('other', 'Verzögerungen im Betriebsablauf'),
  }),
);

/**
 * Codes that withdraw an earlier notice rather than making a statement of their own:
 * 84 "Zug verkehrt richtig gereiht" takes back a coach-order notice, 89 "Reservierungen sind
 * wieder vorhanden" a reservation notice, and 88 "Keine Qualitätsmängel" all of them.
 *
 * They are discarded, and they withdraw nothing (ADR-0011): none of the three appears in the
 * captured response, so acting on them could only be built against invented data. The guard
 * is explicit rather than an absence from the table above, so that adding one there by
 * mistake does not quietly put "Zug verkehrt richtig gereiht" on a platform display.
 *
 * Every message carries a `ts` attribute, so the ordering needed to apply them properly is
 * still available once live data shows the case.
 */
const revokingCodes: ReadonlySet<string> = new Set(['84', '88', '89']);

/** A code this table does not know, or one that only withdraws, resolves to nothing. */
export const resolveQuality = (code: string): QualityCode | undefined =>
  revokingCodes.has(code) ? undefined : qualityCodes.get(code);
