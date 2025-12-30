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
      { id: 'gpt-5.2', name: 'GPT-5.2 Thinking' },
      { id: 'gpt-5.2-chat-latest', name: 'GPT-5.2 Instant' },
      { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex' },
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' }
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
