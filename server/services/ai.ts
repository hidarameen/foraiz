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
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'o1-preview', name: 'o1-preview' },
      { id: 'o1-mini', name: 'o1-mini' }
    ]
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
    ]
  },
  groq: {
    name: 'Groq',
    models: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' }
    ]
  },
  gemini: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)' }
    ]
  },
  huggingface: {
    name: 'HuggingFace',
    models: [
      { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B (HF)' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B (HF)' }
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
