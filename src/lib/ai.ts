import ZAI from 'z-ai-web-dev-sdk';

const zaiPromise = ZAI.create();

export const LLM = {
  async chat({
    messages,
    model = 'glm-4-flash',
  }: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    model?: string;
  }) {
    try {
      const zai = await zaiPromise;

      // Convert system role to assistant for compatibility
      const convertedMessages = messages.map((msg) => ({
        role: msg.role === 'system' ? ('assistant' as const) : msg.role,
        content: msg.content,
      }));

      const result = await zai.chat.completions.create({
        model,
        messages: convertedMessages,
        temperature: 0.7,
        max_tokens: 2048,
        thinking: { type: 'disabled' },
      });

      return result;
    } catch (error) {
      console.error('[LLM.chat] Error:', error);
      return null;
    }
  },
};