const { LLMProvider } = require('./base');

/**
 * Provider para Anthropic Claude API.
 * Usa `anthropic` como prefijo del API key en OPENCODE_API_KEY,
 * o ANTHROPIC_API_KEY directamente.
 */
class AnthropicProvider extends LLMProvider {
  constructor(config = {}) {
    super(config);
    this.apiUrl = (config.apiUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '');
    this.apiKey = config.apiKey || this._resolveApiKey();
    this.model = config.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
    this.maxTokens = config.maxTokens || 8192;
  }

  _resolveApiKey() {
    const fullKey = process.env.OPENCODE_API_KEY || '';
    if (fullKey.startsWith('anthropic:')) return fullKey.slice('anthropic:'.length);
    return process.env.ANTHROPIC_API_KEY || '';
  }

  async chat({ messages, response_format }) {
    if (!this.apiKey) {
      throw new Error(
        'API key de Anthropic no configurada. ' +
        'Usá ANTHROPIC_API_KEY, o OPENCODE_API_KEY=anthropic:<key>'
      );
    }

    // Convertir formato de mensajes universal a formato Anthropic
    const anthropicMessages = this._toAnthropicMessages(messages);
    const system = this._extractSystem(messages);

    const body = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: anthropicMessages
    };

    if (system) body.system = system;

    // Anthropic no soporta response_format nativamente;
    // usamos un extra de prompt para forzar JSON si se pide
    if (response_format?.type === 'json_object') {
      if (anthropicMessages.length > 0) {
        const last = anthropicMessages[anthropicMessages.length - 1];
        if (last.role === 'user') {
          last.content = last.content + '\n\nRespondé SOLO con JSON válido, sin texto adicional.';
        }
      }
    }

    const response = await fetch(`${this.apiUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${text}`);
    }

    const data = await response.json();
    const content = data.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return { content };
  }

  _toAnthropicMessages(messages) {
    const result = [];
    for (const m of messages) {
      if (m.role === 'system') continue; // system se maneja aparte
      let content = m.content;
      if (typeof content !== 'string') {
        content = JSON.stringify(content);
      }
      result.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content });
    }
    return result;
  }

  _extractSystem(messages) {
    const sys = messages.find(m => m.role === 'system');
    return sys?.content || null;
  }

  get name() { return 'anthropic'; }
}

module.exports = { AnthropicProvider };
