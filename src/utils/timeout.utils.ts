export class RequestTimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`TestRail request "${label}" did not respond within ${timeoutMs / 1000}s`);
    this.name = "RequestTimeoutError";
  }
}

/**
 * Rejects when `promise` has not settled within `timeoutMs`. The TestRail client sets no timeout of
 * its own, so a request TestRail never answers would otherwise wait forever.
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(label, timeoutMs)), timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
