import { OpenAIProvider } from './ai-providers/openai';
import { AnthropicProvider } from './ai-providers/anthropic';
import { GroqProvider } from './ai-providers/groq';
import { GeminiProvider } from './ai-providers/gemini';
import { HuggingFaceProvider } from './ai-providers/huggingface';

export interface AIModel {
  id: string;
  name: string;
  provider: AIProvider;
}

export type AIProvider = 'openai' | 'anthropic' | 'groq' | 'huggingface' | 'gemini';

export const AI_CONFIG = {
  openai: {
    name: 'OpenAI',
    models: [
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
    ]
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-4-5-opus-20241124', name: 'Claude 4.5 Opus' },
      { id: 'claude-4-5-sonnet-20240929', name: 'Claude 4.5 Sonnet' },
      { id: 'claude-4-5-haiku-20241017', name: 'Claude 4.5 Haiku' }
    ]
  },
  groq: {
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' }
    ]
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
      { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' }
    ]
  },
  huggingface: {
    name: 'HuggingFace',
    models: [
      { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B (HF)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B (HF)' },
      { id: 'deepseek-ai/deepseek-llm-67b-chat', name: 'DeepSeek 67B' }
    ]
  }
};

export class AIService {
  static async chat(provider: AIProvider, model: string, prompt: string, apiKey: string) {
    switch (provider) {
      case 'openai':
        return OpenAIProvider.chat(model, prompt, apiKey);
      case 'anthropic':
        return AnthropicProvider.chat(model, prompt, apiKey);
      case 'groq':
        return GroqProvider.chat(model, prompt, apiKey);
      case 'gemini':
        return GeminiProvider.chat(model, prompt, apiKey);
      case 'huggingface':
        return HuggingFaceProvider.chat(model, prompt, apiKey);
      default:
        throw new Error(`Provider ${provider} not supported`);
    }
  }
}
