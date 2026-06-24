/**
 * Interfaz base para providers de LLM.
 *
 * Cada provider implementa:
 *   chat({ messages, response_format }) → { content: string }
 */
class LLMProvider {
  constructor(config) {
    this.config = config;
  }

  async chat({ messages, response_format }) {
    throw new Error('chat() debe ser implementado por el provider');
  }

  get name() {
    return this.constructor.name;
  }
}

module.exports = { LLMProvider };
