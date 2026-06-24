const { OpenAIProvider } = require('./openai');
const { AnthropicProvider } = require('./anthropic');
const { LLMProvider } = require('./base');

const PROVIDER_MAP = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider
};

const DEFAULT_PROVIDER = 'openai';

/**
 * Crea una instancia del provider según la variable LLM_PROVIDER.
 *
 * Variables de entorno:
 *   LLM_PROVIDER         — "openai" | "anthropic" (default: "openai")
 *   OPENCODE_API_URL     — URL base de la API (para openai/ollama)
 *   OPENCODE_API_KEY     — API key (para openai); para anthropic: "anthropic:<key>"
 *   OPENCODE_MODEL       — nombre del modelo (default: gpt-4o / claude-sonnet-4)
 *   ANTHROPIC_API_KEY    — API key de Anthropic (alternativa)
 *   ANTHROPIC_MODEL      — modelo de Anthropic (default: claude-sonnet-4-20250514)
 *
 * @param {object} [config] - Configuración override
 * @param {string} [config.provider] - "openai" | "anthropic"
 * @param {string} [config.apiUrl]
 * @param {string} [config.apiKey]
 * @param {string} [config.model]
 * @returns {LLMProvider}
 */
function createProvider(config = {}) {
  const providerName = config.provider || process.env.LLM_PROVIDER || DEFAULT_PROVIDER;
  const ProviderClass = PROVIDER_MAP[providerName];

  if (!ProviderClass) {
    const disponibles = Object.keys(PROVIDER_MAP).join(', ');
    throw new Error(
      `Provider desconocido: "${providerName}". ` +
      `Disponibles: ${disponibles}. ` +
      `Usá LLM_PROVIDER en el entorno, o config.provider.`
    );
  }

  return new ProviderClass(config);
}

module.exports = { createProvider, LLMProvider, PROVIDER_MAP };
