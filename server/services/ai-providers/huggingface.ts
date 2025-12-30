export class HuggingFaceProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `HuggingFace (${model}): Processed "${prompt}"`,
      provider: 'huggingface',
      model
    };
  }
}
