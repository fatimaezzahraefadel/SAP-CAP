// Shared async utilities for feature hooks

/**
 * Checks whether an error is an OData abort error (request was cancelled).
 * These should typically be ignored in UI error handling.
 */
export const isAbortError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'isAbort' in error &&
      (error as { isAbort?: boolean }).isAbort
  );

/**
 * Resolves after the given number of milliseconds. Useful for spacing out retries.
 */
export const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
