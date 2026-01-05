import { OpenAIProvider, OPENAI_MODELS } from './ai-providers/openai';
import { AnthropicProvider, ANTHROPIC_MODELS } from './ai-providers/anthropic';
import { GroqProvider, GROQ_MODELS } from './ai-providers/groq';
import { GeminiProvider, GEMINI_MODELS } from './ai-providers/gemini';
import { HuggingFaceProvider, HUGGINGFACE_MODELS } from './ai-providers/huggingface';

export type AIProvider = 'openai' | 'anthropic' | 'groq' | 'huggingface' | 'gemini';

export const AI_CONFIG = {
  openai: {
    name: 'OpenAI',
    models: OPENAI_MODELS
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    models: ANTHROPIC_MODELS
  },
  groq: {
    name: 'Groq',
    models: GROQ_MODELS
  },
  gemini: {
    name: 'Google Gemini',
    models: GEMINI_MODELS
  },
  huggingface: {
    name: 'HuggingFace',
    models: HUGGINGFACE_MODELS
  }
};

export class AIService {
  static async chat(provider: AIProvider, model: string, prompt: string, apiKey: string) {
    console.log(`[AIService] Sending request to ${provider} using model ${model}`);
    try {
      const response = await this.executeChat(provider, model, prompt, apiKey);
      console.log(`[AIService] Received response from ${provider}`);
      return response;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      console.error(`[AIService] Error from ${provider}:`, errorMsg);
      throw error;
    }
  }

  private static async executeChat(provider: AIProvider, model: string, prompt: string, apiKey: string) {
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
