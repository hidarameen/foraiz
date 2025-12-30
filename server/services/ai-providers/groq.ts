export const GROQ_MODELS = [
  // Featured Models and Systems
  { id: 'groq/compound', name: 'Groq Compound (Agentic System)' },
  { id: 'groq/compound-mini', name: 'Groq Compound Mini' },
  { id: 'openai/gpt-oss-120b', name: 'GPT-OSS 120B (Groq Hosted)' },
  
  // Production Models
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile' },
  { id: 'meta-llama/llama-guard-4-12b', name: 'Llama Guard 4 12B' },
  { id: 'openai/gpt-oss-20b', name: 'GPT OSS 20B' },
  { id: 'whisper-large-v3', name: 'Whisper Large V3' },
  { id: 'whisper-large-v3-turbo', name: 'Whisper Large V3 Turbo' },

  // Preview Models
  { id: 'canopylabs/orpheus-arabic-saudi', name: 'Orpheus Arabic Saudi (Preview)' },
  { id: 'canopylabs/orpheus-v1-english', name: 'Orpheus V1 English (Preview)' },
  { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', name: 'Llama 4 Maverick 17B (Preview)' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B (Preview)' },
  { id: 'meta-llama/llama-prompt-guard-2-22m', name: 'Llama Prompt Guard 2 22M (Preview)' },
  { id: 'meta-llama/llama-prompt-guard-2-86m', name: 'Prompt Guard 2 86M (Preview)' },
  { id: 'moonshotai/kimi-k2-instruct-0905', name: 'Kimi K2 0905 (Preview)' },
  { id: 'openai/gpt-oss-safeguard-20b', name: 'Safety GPT OSS 20B (Preview)' },
  { id: 'qwen/qwen3-32b', name: 'Qwen 3 32B (Preview)' }
];

export class GroqProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `Groq (${model}): Processed "${prompt}"`,
      provider: 'groq',
      model
    };
  }
}
