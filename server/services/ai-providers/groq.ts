export const GROQ_MODELS = [
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  { id: 'gemma2-9b-it', name: 'Gemma 2 9B' }
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
