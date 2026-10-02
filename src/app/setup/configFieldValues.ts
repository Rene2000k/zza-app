/** The four values that pick what a display shows, as typed — validated by the caller. */
export interface ConfigFieldValues {
  readonly station: string;
  readonly platform: string;
  readonly design: string;
  readonly provider: string;
}

/** The fields as query parameters; an empty platform means the whole station, so it is left out. */
export const fieldParams = (values: ConfigFieldValues): Record<string, string> => {
  const platform = values.platform.trim();
  return {
    station: values.station.trim(),
    ...(platform === '' ? {} : { platform }),
    design: values.design,
    provider: values.provider,
  };
};
