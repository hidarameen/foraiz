export const OPENAI_MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
  { id: 'o1-preview', name: 'o1 Preview' },
  { id: 'o1-mini', name: 'o1 Mini' },
  { id: 'gpt-4', name: 'GPT-4' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
];

export class OpenAIProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API Key is required');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
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
        console.error(`[OpenAI Provider] API Error Body:`, errorText);
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {}
        throw new Error(`OpenAI API Error: ${errorMessage}`);
      }

      const data = await response.json();
      const message = data.choices?.[0]?.message?.content || '';
      
      return {
        message: message.trim(),
        provider: 'openai',
        model
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[OpenAI Provider] Error:', errorMsg);
      throw error;
    }
  }
}
