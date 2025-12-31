export const ANTHROPIC_MODELS = [
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
  { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' }
];

export class AnthropicProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    if (!apiKey) {
      throw new Error('Anthropic API Key is required');
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Anthropic Provider] API Error Body:`, errorText);
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {}
        throw new Error(`Anthropic API Error: ${errorMessage}`);
      }

      const data = await response.json();
      const message = data.content?.[0]?.text || '';
      
      return {
        message: message.trim(),
        provider: 'anthropic',
        model
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Anthropic Provider] Error:', errorMsg);
      throw error;
    }
  }
}
