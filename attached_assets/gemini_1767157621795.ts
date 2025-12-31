export const GEMINI_MODELS = [
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
  { id: 'gemini-3-pro-image-preview', name: 'Gemini 3 Pro Image Preview' },
  { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-preview-09-2025', name: 'Gemini 2.5 Flash Preview (09-2025)' },
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
  { id: 'gemini-2.5-flash-native-audio-preview-12-2025', name: 'Gemini 2.5 Flash Native Audio Preview' },
  { id: 'gemini-2.5-flash-preview-tts', name: 'Gemini 2.5 Flash Preview TTS' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
  { id: 'gemini-2.0-pro-exp', name: 'Gemini 2.0 Pro (Experimental)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
  { id: 'gemini-2.0-flash-lite-preview-09-2025', name: 'Gemini 2.0 Flash-Lite Preview' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B' }
];

export class GeminiProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    return {
      message: `Gemini (${model}): Processed "${prompt}"`,
      provider: 'gemini',
      model
    };
  }
}
