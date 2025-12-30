export class AnthropicProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `Anthropic (${model}): Processed "${prompt}"`,
      provider: 'anthropic',
      model
    };
  }
}
