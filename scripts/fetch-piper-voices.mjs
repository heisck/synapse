#!/usr/bin/env node
/**
 * Bundle the Piper fallback voices at build time.
 *
 * HuggingFace migrated the Piper voice `.onnx` files to their Xet storage
 * backend, which now 403s plain anonymous downloads — in the browser AND
 * server-side (see the note in src/lib/voice/piper.ts). A fallback voice that
 * depends on the same flaky backend as the primary isn't a fallback, so we
 * source the models from the k2-fsa/sherpa-onnx GitHub release instead (a plain
 * CDN, no Xet) and drop them into public/piper/ at build time. The browser then
 * loads them same-origin, fully independent of HuggingFace.
 *
 * Each sherpa tarball is self-contained: it carries both `<voice>.onnx` and
 * `<voice>.onnx.json` (the config the runtime needs). We extract just those two.
 *
 * Idempotent: a voice already present in public/piper/ is skipped, so repeated
 * local `npm run dev` runs don't re-download. Edit VOICES to change the set.
 */
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import unbzip2 from 'unbzip2-stream';
import tarStream from 'tar-stream';

const MAX_ATTEMPTS = 3; // GitHub can reset a long transfer mid-stream — just retry

// Keep in sync with PIPER_VOICES in src/lib/voice/piper.ts.
const VOICES = [
  'en_US-amy-low',
  'en_US-danny-low',
  'en_US-lessac-low',
  'en_GB-alan-low',
  'en_US-hfc_female-medium',
  'en_US-ryan-high',
];

const RELEASE_BASE = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models';
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'piper');
const MIN_ONNX_BYTES = 1_000_000; // a real model is tens of MB; anything smaller is a bad extract

function isPresent(voice) {
  const onnx = join(OUT_DIR, `${voice}.onnx`);
  const json = join(OUT_DIR, `${voice}.onnx.json`);
  try {
    return existsSync(json) && existsSync(onnx) && statSync(onnx).size >= MIN_ONNX_BYTES;
  } catch {
    return false;
  }
}

/** One download+extract attempt into .part temp files, promoted on success. */
async function extractOnce(voice, url) {
  const onnxPath = join(OUT_DIR, `${voice}.onnx`);
  const jsonPath = join(OUT_DIR, `${voice}.onnx.json`);
  const onnxTmp = `${onnxPath}.part`;
  const jsonTmp = `${jsonPath}.part`;
  await rm(onnxTmp, { force: true });
  await rm(jsonTmp, { force: true });

  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download failed (HTTP ${res.status})`);

  const extract = tarStream.extract();
  extract.on('entry', (header, stream, next) => {
    const base = header.name.split('/').pop();
    const dest = base === `${voice}.onnx` ? onnxTmp : base === `${voice}.onnx.json` ? jsonTmp : null;
    // Every entry stream needs an error handler — a mid-stream network reset
    // emits 'error' on the current entry, and an unhandled one crashes Node
    // before the outer pipeline's rejection can be caught.
    if (dest) {
      pipeline(stream, createWriteStream(dest)).then(() => next(), next);
    } else {
      // Not a file we want (MODEL_CARD, tokens.txt, espeak-ng-data/…) — drain it.
      stream.on('error', next);
      stream.on('end', () => next());
      stream.resume();
    }
  });

  await pipeline(Readable.fromWeb(res.body), unbzip2(), extract);

  // The whole archive was read cleanly — promote the temps into place. A reset
  // would have rejected the pipeline above, leaving the real files untouched.
  if (!existsSync(onnxTmp) || !existsSync(jsonTmp) || statSync(onnxTmp).size < MIN_ONNX_BYTES) {
    await rm(onnxTmp, { force: true });
    await rm(jsonTmp, { force: true });
    throw new Error('expected .onnx/.onnx.json not found (or too small) in archive');
  }
  await rename(onnxTmp, onnxPath);
  await rename(jsonTmp, jsonPath);
}

async function fetchVoice(voice) {
  if (isPresent(voice)) {
    console.log(`[piper-voices] ${voice}: already present, skipping`);
    return;
  }
  const url = `${RELEASE_BASE}/vits-piper-${voice}.tar.bz2`;
  let lastErr;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[piper-voices] ${voice}: downloading + extracting (attempt ${attempt}/${MAX_ATTEMPTS})`);
    try {
      await extractOnce(voice, url);
      const size = statSync(join(OUT_DIR, `${voice}.onnx`)).size;
      console.log(`[piper-voices] ${voice}: done (${(size / 1e6).toFixed(1)} MB)`);
      return;
    } catch (err) {
      lastErr = err;
      console.warn(`[piper-voices] ${voice}: attempt ${attempt} failed — ${err.message ?? err}`);
    }
  }
  throw lastErr ?? new Error('unknown failure');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let failed = 0;
  for (const voice of VOICES) {
    try {
      await fetchVoice(voice);
    } catch (err) {
      failed++;
      console.error(`[piper-voices] ${voice}: FAILED — ${err.message}`);
    }
  }
  if (failed) {
    console.error(`[piper-voices] ${failed}/${VOICES.length} voice(s) failed to bundle.`);
    process.exitCode = 1;
  }
}

main();
