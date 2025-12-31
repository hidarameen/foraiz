export const GROQ_MODELS = [
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B' },
  { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' }
];

export class GroqProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    if (!apiKey) {
      throw new Error('Groq API Key is required');
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'mixtral-8x7b-32768',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Groq Provider] API Error Body:`, errorText);
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {}
        throw new Error(`Groq API Error: ${errorMessage}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message?.content || '';
      
      return {
        message: message.trim(),
        provider: 'groq',
        model
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Groq Provider] Error:', errorMsg);
      throw error;
    }
  }
}
