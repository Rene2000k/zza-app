/**
 * What every display shares — and nothing more (ADR-0009).
 *
 * A block lives here only when it owns something a design must not re-implement: a
 * mechanism (the running message line, the coach strip, and later text fitting and
 * blinking) or a rule that belongs to the domain. Every choice between several true
 * renderings — whether a field states "+7" or "10:57", the wording of a hint, which parts a
 * row has and in what order — belongs to the design, which builds it from the formatters
 * here and from the domain functions (`selectViaStops`, `headlineStation`, `delayMinutes`,
 * `displayableMessages`, `isSamePlatform`).
 *
 * The blocks take their look from wherever a design places them: they inherit font and
 * colour rather than naming their own. The one exception is the stroke width of the coach
 * strip, which has nothing to inherit from:
 *
 * | Token                    | Used for                   |
 * | ------------------------ | -------------------------- |
 * | `--zza-formation-stroke` | outline of the coach strip |
 */
export { Ticker } from './Ticker';
export { TrainFormationDisplay } from './TrainFormationDisplay';
export { formatClockTime, formatDelay } from './format';
