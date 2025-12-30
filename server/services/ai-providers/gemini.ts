export class GeminiProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `Gemini (${model}): Processed "${prompt}"`,
      provider: 'gemini',
      model
    };
  }
}
