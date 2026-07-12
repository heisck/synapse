/**
 * Stream watchdog (UNIFIED-PLAN task 1, req B8/B5): reads a text stream with an
 * inter-chunk timeout so a stalled provider can never leave the UI hanging on a
 * partial message. The first chunk gets a longer grace period (model spin-up /
 * cold routing); after that, silence beyond `chunkTimeoutMs` aborts the read.
 */

export class StreamStalledError extends Error {
  code = 'STREAM_STALLED' as const;
  /** True when we never received a single chunk (vs. died mid-response). */
  readonly beforeFirstChunk: boolean;
  constructor(beforeFirstChunk: boolean) {
    super(
      beforeFirstChunk
        ? 'The AI took too long to start responding.'
        : 'The AI response stalled and was cancelled.',
    );
    this.beforeFirstChunk = beforeFirstChunk;
  }
}

export interface WatchdogOptions {
  /** Max silence between chunks once streaming has started. Default 20s. */
  chunkTimeoutMs?: number;
  /** Max wait for the FIRST chunk. Default 45s. */
  firstChunkTimeoutMs?: number;
  /** Called with the accumulated text after every chunk. */
  onChunk: (accumulated: string) => void;
}

/**
 * Consumes `body` chunk by chunk, calling `onChunk` with the accumulated text.
 * Resolves with the full text on clean end. Throws StreamStalledError on
 * inter-chunk timeout (after cancelling the underlying stream, so the
 * connection is actually torn down, not orphaned).
 */
export async function readStreamWithWatchdog(
  body: ReadableStream<Uint8Array>,
  { chunkTimeoutMs = 20_000, firstChunkTimeoutMs = 45_000, onChunk }: WatchdogOptions,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let acc = '';
  let receivedFirst = false;

  try {
    for (;;) {
      const timeoutMs = receivedFirst ? chunkTimeoutMs : firstChunkTimeoutMs;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new StreamStalledError(!receivedFirst)), timeoutMs);
        }),
      ]).finally(() => clearTimeout(timer));

      if (result.done) break;
      acc += decoder.decode(result.value, { stream: true });
      if (acc) receivedFirst = true;
      onChunk(acc);
    }
    acc += decoder.decode();
    return acc;
  } catch (err) {
    // Tear the stream down so the fetch doesn't linger half-open
    reader.cancel().catch(() => {});
    throw err;
  } finally {
    reader.releaseLock?.();
  }
}
