import { NextRequest, NextResponse } from 'next/server';

/**
 * Piper voice model proxy.
 *
 * HuggingFace migrated the large Piper `.onnx` files to their Xet storage
 * backend (`cas-bridge.xethub.hf.co`). The browser download path the voice
 * library uses — a plain fetch of the `resolve/...` URL — now 302-redirects
 * there and the redirect returns an error body (XML `AccessDenied`) instead of
 * the model. The library caches whatever bytes come back, so ONNX then chokes
 * with "protobuf parsing failed" (ERROR_CODE 7) and the retry re-fetches the
 * same bad source.
 *
 * We fetch the file server-side instead (Vercel -> HF, no browser CORS/Xet
 * redirect for the client), validate it really is a model, and re-serve it
 * same-origin so the browser gets clean bytes it can cache. The client
 * pre-seeds these into OPFS so the voice library never touches HF directly.
 */

export const runtime = 'nodejs';

// Allowlist: voiceId -> path within the piper-voices repo. Mirrors the voices
// offered in src/lib/voice/piper.ts. An allowlist (not a passthrough) keeps
// this from becoming an open proxy / SSRF vector.
const PATH_MAP: Record<string, string> = {
  'en_US-amy-low': 'en/en_US/amy/low/en_US-amy-low.onnx',
  'en_US-danny-low': 'en/en_US/danny/low/en_US-danny-low.onnx',
  'en_US-lessac-low': 'en/en_US/lessac/low/en_US-lessac-low.onnx',
  'en_GB-alan-low': 'en/en_GB/alan/low/en_GB-alan-low.onnx',
  'en_US-hfc_female-medium': 'en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx',
  'en_US-ryan-high': 'en/en_US/ryan/high/en_US-ryan-high.onnx',
};

// rhasspy is the canonical upstream for Piper voices (identical layout to the
// library's default repo, but the complete source of truth).
const HF_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

export async function GET(req: NextRequest) {
  const voice = req.nextUrl.searchParams.get('voice') ?? '';
  const file = req.nextUrl.searchParams.get('file') === 'json' ? 'json' : 'onnx';

  const modelPath = PATH_MAP[voice];
  if (!modelPath) {
    return NextResponse.json({ error: `Unknown voice: ${voice}` }, { status: 400 });
  }

  const url = file === 'json' ? `${HF_BASE}/${modelPath}.json` : `${HF_BASE}/${modelPath}`;

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      redirect: 'follow',
      // A real UA avoids HF handing back a bot/error variant.
      headers: { 'User-Agent': 'synapse-voice-proxy/1.0' },
    });
  } catch (err) {
    console.error('[/api/voice/piper] upstream fetch threw:', err);
    return NextResponse.json({ error: 'Voice source unreachable' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    console.error(`[/api/voice/piper] upstream ${upstream.status} for ${url}`);
    return NextResponse.json({ error: `Voice source returned ${upstream.status}` }, { status: 502 });
  }

  // Guard against error pages masquerading as a model (the Xet failure returns
  // XML; other outages return HTML). A real .onnx is octet-stream/binary.
  const upstreamType = (upstream.headers.get('content-type') ?? '').toLowerCase();
  if (file === 'onnx' && (upstreamType.includes('xml') || upstreamType.includes('html'))) {
    console.error(`[/api/voice/piper] non-model content-type "${upstreamType}" for ${url}`);
    return NextResponse.json({ error: 'Voice source returned a non-model response' }, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Content-Type', file === 'json' ? 'application/json' : 'application/octet-stream');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len); // lets the client show real progress
  // The model is content-addressed and never changes — cache hard.
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');

  return new NextResponse(upstream.body, { status: 200, headers });
}
