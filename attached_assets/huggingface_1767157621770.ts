export const HUGGINGFACE_MODELS = [
  { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B (HF)' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B (HF)' },
  { id: 'deepseek-ai/deepseek-llm-67b-chat', name: 'DeepSeek 67B' }
];

export class HuggingFaceProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `HuggingFace (${model}): Processed "${prompt}"`,
      provider: 'huggingface',
      model
    };
  }
}
