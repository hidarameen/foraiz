export const HUGGINGFACE_MODELS = [
  { id: 'meta-llama/Llama-3.1-70B-Instruct', name: 'Llama 3.1 70B' },
  { id: 'mistralai/Mistral-7B-Instruct-v0.3', name: 'Mistral 7B' },
  { id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', name: 'Mixtral 8x7B' }
];

export class HuggingFaceProvider {
  static async chat(model: string, prompt: string, apiKey: string) {
    if (!apiKey) {
      throw new Error('HuggingFace API Key is required');
    }

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.3
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[HuggingFace Provider] API Error Body:`, errorText);
        let errorMessage = response.statusText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error?.[0] || errorData.error || errorMessage;
        } catch (e) {}
        throw new Error(`HuggingFace API Error: ${errorMessage}`);
      }

      const data = await response.json();
      let message = '';
      
      // Handle different response formats from HuggingFace
      if (Array.isArray(data)) {
        message = data[0]?.generated_text || '';
        // Remove the prompt from the response
        if (message.startsWith(prompt)) {
          message = message.substring(prompt.length);
        }
      } else if (data.generated_text) {
        message = data.generated_text;
        if (message.startsWith(prompt)) {
          message = message.substring(prompt.length);
        }
      }
      
      return {
        message: message.trim(),
        provider: 'huggingface',
        model
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[HuggingFace Provider] Error:', errorMsg);
      throw error;
    }
  }
}
