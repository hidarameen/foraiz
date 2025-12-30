export const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  { id: 'claude-4-5-opus-20241124', name: 'Claude 4.5 Opus' },
  { id: 'claude-4-5-sonnet-20240929', name: 'Claude 4.5 Sonnet' },
  { id: 'claude-4-5-haiku-20241017', name: 'Claude 4.5 Haiku' }
];

export class AnthropicProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `Anthropic (${model}): Processed "${prompt}"`,
      provider: 'anthropic',
      model
    };
  }
}
