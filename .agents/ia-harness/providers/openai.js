const { LLMProvider } = require('./base');

/**
 * Provider para APIs compatibles con OpenAI:
 * - OpenAI API (api.openai.com)
 * - Ollama (localhost:11434/v1)
 * - LM Studio, LocalAI, etc.
 */
class OpenAIProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiUrl = (config.apiUrl || process.env.OPENCODE_API_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey || process.env.OPENCODE_API_KEY || '';
    this.model = config.model || process.env.OPENCODE_MODEL || 'gpt-4o';
  }

  async chat({ messages, response_format }) {
    if (!this.apiKey) {
      throw new Error(
        'OPENCODE_API_KEY no configurada. ' +
        'Usá OPENCODE_API_KEY en el entorno, o configurá apiKey en el constructor.'
      );
    }

    const body = {
      model: this.model,
      messages: this._truncateMessages(messages)
    };

    if (response_format) {
      body.response_format = response_format;
    }

    const response = await fetch(`${this.apiUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    return { content: data.choices[0].message.content };
  }

  /** Trunca mensajes individuales que excedan 80k caracteres */
  _truncateMessages(messages) {
    return messages.map(m => ({
      ...m,
      content: m.content.length > 80000
        ? m.content.slice(0, 80000) + '\n... [truncado]'
        : m.content
    }));
  }

  get name() { return 'openai'; }
}

module.exports = { OpenAIProvider };
