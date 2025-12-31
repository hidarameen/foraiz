export const GEMINI_MODELS = [
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash Exp' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
  { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro' }
];

export class GeminiProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    if (!apiKey) {
      throw new Error('Google Gemini API Key is required');
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 500
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Gemini Provider] API Error Body:`, errorText);
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {}
        throw new Error(`Google Gemini API Error: ${errorMessage}`);
      }

      const data = await response.json();
      const message = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      return {
        message: message.trim(),
        provider: 'gemini',
        model
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Gemini Provider] Error:', errorMsg);
      throw error;
    }
  }
}
