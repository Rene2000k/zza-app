/**
 * A data source failed in a way worth telling apart from a broken network.
 *
 * Carries the HTTP status where there was one, so diagnostics can say "the source answered
 * 503" instead of parsing it out of a message. Provider-neutral on purpose: the layers above
 * see a status code, never the vendor's error format.
 */
export class ProviderError extends Error {
  /** HTTP status of the failed response; undefined when the answer was not usable at all. */
  readonly status: number | undefined;

  constructor(message: string, options: { readonly status?: number } = {}) {
    super(message);
    this.name = 'ProviderError';
    this.status = options.status;
  }
}
