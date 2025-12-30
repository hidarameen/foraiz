export class OpenAIProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `OpenAI (${model}): Processed "${prompt}"`,
      provider: 'openai',
      model
    };
  }
}
