import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import WebSocket from 'ws';

/**
 * Cloud text-to-speech — the network voice used when on-device engines can't
 * run (notably iOS, where Kokoro crashes the tab and Piper crashes memory).
 *
 * Two keyless providers, best-quality first:
 *  1. Microsoft Edge "read aloud" Neural voices — genuinely human, streamed over
 *     a WebSocket. Needs a rolling Sec-MS-GEC token (a SHA-256 of the public
 *     trusted-client token + a 5-minute-rounded Windows FILETIME).
 *  2. Google Translate TTS — keyless and reliable but robotic and capped at
 *     ~200 chars, so we chunk. The fallback when Edge's DRM handshake is refused.
 *
 * Returns audio/mpeg. `X-TTS-Engine` says which provider answered.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

const EDGE_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_WSS = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const DEFAULT_VOICE = 'en-US-AriaNeural';

function edgeSecToken(): string {
  // Windows FILETIME ticks (100ns since 1601), rounded down to 5 minutes.
  // BigInt() constructor (not literals) so it compiles under older TS targets.
  const ticks = BigInt(Math.floor(Date.now() / 1000 + 11644473600)) * BigInt(10000000);
  const rounded = ticks - (ticks % BigInt(3000000000));
  return crypto.createHash('sha256').update(rounded.toString() + EDGE_TOKEN, 'ascii').digest('hex').toUpperCase();
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function edgeTTS(text: string, voice: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const url = `${EDGE_WSS}?TrustedClientToken=${EDGE_TOKEN}&Sec-MS-GEC=${edgeSecToken()}&Sec-MS-GEC-Version=1-131.0.2903.99`;
    const ws = new WebSocket(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
        Origin: 'chrome-extension://jdiccldimpahdcignhonbofoenhakjnd',
      },
    });
    const chunks: Buffer[] = [];
    const reqId = crypto.randomUUID().replace(/-/g, '');
    const timer = setTimeout(() => { ws.terminate(); reject(new Error('edge timeout')); }, 12_000);

    ws.on('open', () => {
      ws.send(
        `X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n` +
          '{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}',
      );
      const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'>${escapeXml(text)}</voice></speak>`;
      ws.send(`X-RequestId:${reqId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toString()}\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data: Buffer, isBinary: boolean) => {
      if (isBinary) {
        // Binary frame: 2-byte big-endian header length, header, then audio.
        const headerLen = (data[0] << 8) | data[1];
        chunks.push(data.subarray(2 + headerLen));
      } else if (data.toString().includes('Path:turn.end')) {
        clearTimeout(timer);
        ws.close();
        resolve(Buffer.concat(chunks));
      }
    });
    ws.on('unexpected-response', (_req, res) => { clearTimeout(timer); reject(new Error(`edge http ${res.statusCode}`)); });
    ws.on('error', (err) => { clearTimeout(timer); reject(err); });
  });
}

/** Split text into ≤180-char pieces on sentence/word boundaries for Google TTS. */
function chunkForGoogle(text: string, max = 180): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    const punct = Math.max(rest.lastIndexOf('. ', max), rest.lastIndexOf(', ', max), rest.lastIndexOf('; ', max));
    if (punct > max * 0.5) cut = punct + 1;
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

async function googleTTS(text: string): Promise<Buffer> {
  const parts = chunkForGoogle(text);
  const buffers: Buffer[] = [];
  for (const part of parts) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(part)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`google tts ${res.status}`);
    buffers.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(buffers);
}

export async function POST(req: NextRequest) {
  let body: { text?: string; voice?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  const text = String(body.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 1200);
  if (!text) return NextResponse.json({ error: 'No text to speak' }, { status: 400 });
  // Only accept well-formed Edge voice names ("xx-YY-NameNeural"); else default.
  const voice = typeof body.voice === 'string' && /^[a-z]{2}-[A-Z]{2}-[A-Za-z]+Neural$/.test(body.voice)
    ? body.voice
    : DEFAULT_VOICE;

  let audio: Buffer | null = null;
  let engine = 'edge';
  try {
    audio = await edgeTTS(text, voice);
    if (!audio.length) throw new Error('edge returned no audio');
  } catch (edgeErr) {
    console.warn('[/api/voice/tts] Edge unavailable, falling back to Google:', edgeErr instanceof Error ? edgeErr.message : edgeErr);
    engine = 'google';
    try {
      audio = await googleTTS(text);
    } catch (googleErr) {
      console.error('[/api/voice/tts] Google fallback also failed:', googleErr instanceof Error ? googleErr.message : googleErr);
      return NextResponse.json({ error: 'Voice service unavailable' }, { status: 502 });
    }
  }

  return new Response(new Uint8Array(audio), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.length),
      'X-TTS-Engine': engine,
      'Cache-Control': 'no-store',
    },
  });
}
