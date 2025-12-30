export class GroqProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `Groq (${model}): Processed "${prompt}"`,
      provider: 'groq',
      model
    };
  }
}
