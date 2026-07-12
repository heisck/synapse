import { describe, it, expect } from 'vitest';
import { readStreamWithWatchdog, StreamStalledError } from '@/lib/streamWatchdog';

function streamOf(chunks: string[], opts: { delayMs?: number; hangAfter?: number } = {}): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (opts.hangAfter !== undefined && i >= opts.hangAfter) {
        // Simulate a stalled provider: never enqueue, never close
        await new Promise(() => {});
      }
      if (i < chunks.length) {
        if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
        controller.enqueue(enc.encode(chunks[i++]));
      } else {
        controller.close();
      }
    },
  });
}

describe('readStreamWithWatchdog (task 1, B8)', () => {
  it('accumulates a healthy stream and reports chunks', async () => {
    const seen: string[] = [];
    const text = await readStreamWithWatchdog(streamOf(['Hello ', 'world']), {
      onChunk: (acc) => seen.push(acc),
    });
    expect(text).toBe('Hello world');
    expect(seen[seen.length - 1]).toBe('Hello world');
  });

  it('throws StreamStalledError when chunks stop mid-stream', async () => {
    const stream = streamOf(['partial answer... '], { hangAfter: 1 });
    await expect(
      readStreamWithWatchdog(stream, { chunkTimeoutMs: 50, firstChunkTimeoutMs: 100, onChunk: () => {} }),
    ).rejects.toSatisfy((e: unknown) => e instanceof StreamStalledError && !e.beforeFirstChunk);
  });

  it('flags a stall before the first chunk distinctly', async () => {
    const stream = streamOf(['never delivered'], { hangAfter: 0 });
    await expect(
      readStreamWithWatchdog(stream, { chunkTimeoutMs: 50, firstChunkTimeoutMs: 60, onChunk: () => {} }),
    ).rejects.toSatisfy((e: unknown) => e instanceof StreamStalledError && e.beforeFirstChunk);
  });
});
