const DEFAULT_MAX_RUNS = parseInt(process.env.FC_MAX_RUNS || '20', 10);
const DEFAULT_MAX_TIMEOUT = parseInt(process.env.FC_MAX_TIMEOUT || '6000', 10);

interface PropertyConfigOptions {
  numRuns?: number;
  timeout?: number;
}

/**
 * Utility to keep property-based tests fast locally while still validating overrides.
 * Caps numRuns/timeout using FC_MAX_* env vars so suites outside voice-coach adopt
 * the same limits as the heavy RealTimeCoach tests.
 */
export function propertyConfig(options?: PropertyConfigOptions) {
  const requestedRuns = options?.numRuns ?? DEFAULT_MAX_RUNS;
  const requestedTimeout = options?.timeout ?? DEFAULT_MAX_TIMEOUT;

  return {
    numRuns: Math.min(requestedRuns, DEFAULT_MAX_RUNS),
    timeout: Math.min(requestedTimeout, DEFAULT_MAX_TIMEOUT),
  };
}
