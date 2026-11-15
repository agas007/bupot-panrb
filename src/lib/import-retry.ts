const MAX_RATE_LIMIT_RETRIES = 3;

async function getRetryDelayMs(response: Response) {
  const header = response.headers.get("Retry-After")?.trim();
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, Math.ceil(seconds * 1000));
    const date = Date.parse(header);
    if (Number.isFinite(date)) return Math.max(1000, date - Date.now());
  }

  try {
    const body = await response.clone().json() as { retryAfter?: unknown };
    if (typeof body.retryAfter === "number" && Number.isFinite(body.retryAfter) && body.retryAfter >= 0) {
      return Math.max(1000, Math.ceil(body.retryAfter * 1000));
    }
  } catch {
    // A proxy may return a non-JSON 429 response.
  }
  return 60_000;
}

/** Retry only rejected batches; network and server failures may already have written data. */
export async function sendImportBatch(
  send: () => Promise<Response>,
  onWait: (secondsRemaining: number) => void,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
) {
  for (let attempt = 0; ; attempt += 1) {
    const response = await send();
    if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) return response;

    let remainingMs = await getRetryDelayMs(response);
    while (remainingMs > 0) {
      onWait(Math.ceil(remainingMs / 1000));
      const intervalMs = Math.min(1000, remainingMs);
      await wait(intervalMs);
      remainingMs -= intervalMs;
    }
    onWait(0);
  }
}
