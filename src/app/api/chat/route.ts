import { NextRequest, NextResponse } from 'next/server';
import { LLM } from '@/lib/ai';
import {
  buildDiscoveryPrompt,
  buildSessionStarterPrompt,
  buildCoreTutorPrompt,
} from '@/lib/prompts';
import type { LearnerProfile, MasteryMap, DecisionLoopState } from '@/types';

// --- In-memory rate limiter (30 req/min per IP) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// --- Input sanitization ---
function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, 5000);
}

// --- Dedupe consecutive same-role messages, keep last 14 ---
function dedupeMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const deduped: typeof messages = [];
  for (const msg of messages) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === msg.role) {
      prev.content = msg.content; // keep the latest
    } else {
      deduped.push({ ...msg });
    }
  }
  return deduped.slice(-14);
}

// --- Persona instructions ---
const PERSONA_INSTRUCTIONS: Record<string, string> = {
  professor:
    'You are a distinguished professor. Use formal, academic language with precise terminology. Structure explanations methodically. Reference established theories and frameworks. Maintain a scholarly yet supportive tone. Use phrases like "Let us examine," "One must consider," "The evidence suggests."',
  coach:
    'You are an energetic sports coach. Use motivational language and sports analogies. Break learning into "drills" and "plays." Celebrate progress with enthusiasm. Push the learner to go further. Use phrases like "Let\'s crush this," "Great hustle," "You\'re in the zone," "Time to level up." Keep energy high and focus on actionable steps.',
  storyteller:
    'You are a captivating storyteller. Weave narratives, analogies, and vivid examples into every explanation. Use "Imagine..." and "Think of it like..." patterns. Create scenarios and characters to illustrate concepts. Make abstract ideas concrete through stories. Draw parallels to everyday experiences.',
  friend:
    'You are a friendly peer who happens to be great at explaining things. Use casual, conversational language. Say "dude," "awesome," "makes sense?" Keep it light and relatable. Use everyday analogies. Avoid jargon — if you use a technical term, immediately explain it simply. Keep explanations short and punchy.',
}

// --- Default system prompt ---
const DEFAULT_SYSTEM_PROMPT =
  'You are Synapse, a friendly and adaptive AI tutor. Help the learner understand the topic clearly. Use simple language, stories, and analogies. Be concise but thorough.';

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 },
      );
    }

    const body = await request.json();

    // --- Provider mode: body has `messages` array ---
    if (body.messages && Array.isArray(body.messages)) {
      const sanitized = body.messages.map((m: { role: string; content: string }) => ({
        role: m.role,
        content: sanitize(m.content || ''),
      }));
      const deduped = dedupeMessages(sanitized);

      const result = await LLM.chat({ messages: deduped });
      if (!result?.choices?.[0]?.message?.content) {
        return NextResponse.json(
          { error: 'No response from AI provider.' },
          { status: 502 },
        );
      }

      return NextResponse.json({
        response: result.choices[0].message.content,
        phase: 'teaching',
        messageCount: deduped.length,
        provider: 'zai',
        model: result.model || 'glm-4-flash',
      });
    }

    // --- Legacy mode ---
    const {
      message,
      phase,
      topic,
      learnerProfile,
      masteryMap,
      decisionState,
      history,
      persona,
    } = body;

    const userMessage = sanitize(message || '');
    if (!userMessage) {
      return NextResponse.json(
        { error: 'Message is required.' },
        { status: 400 },
      );
    }

    // Build system prompt based on phase
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    const profile: LearnerProfile = learnerProfile || {
      learningStyle: 'reading',
      pace: 'steady',
      vocabularySensitive: true,
      prefersStory: true,
      prefersBigPicture: false,
      simpleGrammar: false,
      jargonTolerance: 'medium',
      masteryApproach: 'evidence',
    };
    const mastery: MasteryMap = masteryMap || {};
    const decision: DecisionLoopState = decisionState || {
      confusionScore: 0,
      masteryState: 'unknown',
      responseQuality: 5,
      cognitiveLoad: 'low',
      motivation: 'medium',
    };

    switch (phase) {
      case 'discovery':
        systemPrompt = buildDiscoveryPrompt();
        break;
      case 'starter':
        systemPrompt = buildSessionStarterPrompt(topic || 'the topic', profile);
        break;
      case 'teaching':
        systemPrompt = buildCoreTutorPrompt(
          topic || 'the topic',
          profile,
          mastery,
          decision,
        );
        break;
      default:
        break;
    }

    // Prepend persona instruction to system prompt
    const personaId = typeof persona === 'string' ? persona : 'storyteller'
    const personaInstruction = PERSONA_INSTRUCTIONS[personaId] || PERSONA_INSTRUCTIONS['storyteller']
    systemPrompt = `[PERSONA INSTRUCTION — adopt this voice/style for ALL responses]: ${personaInstruction}\n\n${systemPrompt}`

    // Trim system prompt to 3000 chars
    systemPrompt = systemPrompt.slice(0, 3000);

    // Build messages array from history + current message
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    if (Array.isArray(history)) {
      for (const h of history) {
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: sanitize(h.content || '') });
        }
      }
    }

    messages.push({ role: 'user', content: userMessage });
    const deduped = dedupeMessages(messages) as Array<{
      role: 'system' | 'user' | 'assistant';
      content: string;
    }>;

    const result = await LLM.chat({ messages: deduped });
    if (!result?.choices?.[0]?.message?.content) {
      return NextResponse.json(
        { error: 'No response from AI. Please try again.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      response: result.choices[0].message.content,
      phase: phase || 'default',
      messageCount: deduped.length,
      provider: 'zai',
      model: result.model || 'glm-4-flash',
    });
  } catch (error) {
    console.error('[/api/chat] Error:', error);
    return NextResponse.json(
      {
        error:
          'Something went wrong while generating a response. Please try again.',
        response:
          "I'm having trouble right now. Could you try rephrasing your question?",
      },
      { status: 500 },
    );
  }
}