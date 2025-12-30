export const OPENAI_MODELS = [
  { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro' },
  { id: 'gpt-5.2', name: 'GPT-5.2' },
  { id: 'gpt-5.2-chat-latest', name: 'GPT-5.2 Chat' },
  { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex' },
  { id: 'gpt-5.2-codex-max', name: 'GPT-5.2 Codex Max' },
  { id: 'gpt-5.1', name: 'GPT-5.1' },
  { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex' },
  { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max' },
  { id: 'gpt-5', name: 'GPT-5' },
  { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
  { id: 'gpt-5-chat-latest', name: 'GPT-5 Chat (ChatGPT)' },
  { id: 'gpt-5-pro', name: 'GPT-5 Pro' },
  { id: 'gpt-4.1', name: 'GPT-4.1' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'o3-pro', name: 'o3 Pro' },
  { id: 'o3', name: 'o3' },
  { id: 'o3-mini', name: 'o3 Mini' },
  { id: 'o3-deep-research', name: 'o3 Deep Research' },
  { id: 'o4-mini', name: 'o4 Mini' },
  { id: 'o4-mini-deep-research', name: 'o4 Mini Deep Research' },
  { id: 'o1-pro', name: 'o1 Pro' },
  { id: 'o1', name: 'o1' },
  { id: 'o1-mini', name: 'o1-mini' },
  { id: 'gpt-oss-120b', name: 'GPT OSS 120B' },
  { id: 'gpt-oss-20b', name: 'GPT OSS 20B' },
  { id: 'gpt-image-1.5', name: 'GPT Image 1.5' },
  { id: 'chatgpt-image-latest', name: 'ChatGPT Image Latest' },
  { id: 'gpt-image-1', name: 'GPT Image 1' },
  { id: 'gpt-image-1-mini', name: 'GPT Image 1 Mini' },
  { id: 'sora-2', name: 'Sora 2' },
  { id: 'sora-2-pro', name: 'Sora 2 Pro' },
  { id: 'gpt-realtime', name: 'GPT Realtime' },
  { id: 'gpt-realtime-mini', name: 'GPT Realtime Mini' },
  { id: 'gpt-audio', name: 'GPT Audio' },
  { id: 'gpt-audio-mini', name: 'GPT Audio Mini' },
  { id: 'gpt-4o-mini-tts', name: 'GPT-4o Mini TTS' },
  { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe' },
  { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini Transcribe' },
  { id: 'computer-use-preview', name: 'Computer Use Preview' },
  { id: 'gpt-4o-mini-search-preview', name: 'GPT-4o Mini Search Preview' },
  { id: 'gpt-4o-search-preview', name: 'GPT-4o Search Preview' }
];

export class OpenAIProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `OpenAI (${model}): Processed "${prompt}"`,
      provider: 'openai',
      model
    };
  }
}
