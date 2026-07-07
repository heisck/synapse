import { NextRequest, NextResponse } from 'next/server';

const MAX_TTS_CHARS = 1024;

function splitToFirstSentence(text: string): string {
  // Split on sentence-ending punctuation
  const match = text.match(/^.+?[.!?。！？]/);
  if (match && match[0].length <= MAX_TTS_CHARS) {
    return match[0];
  }
  // Fallback: just truncate
  return text.slice(0, MAX_TTS_CHARS);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let { text, voice, speed } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required for speech synthesis.' },
        { status: 400 },
      );
    }

    // If text exceeds limit, split and use first chunk
    let ttsText = text.trim();
    if (ttsText.length > MAX_TTS_CHARS) {
      ttsText = splitToFirstSentence(ttsText);
    }

    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const response = await zai.audio.tts.create({
      input: ttsText,
      voice: voice || 'tongtong',
      speed: speed || 1.0,
      response_format: 'mp3',
      stream: false,
    });

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (error) {
    console.error('[/api/tts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech. Please try again.' },
      { status: 500 },
    );
  }
}