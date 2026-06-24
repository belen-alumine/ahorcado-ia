module.exports = {
  name: 'read_url',
  description: 'Obtiene el contenido de una URL externa y lo devuelve como texto. Útil para consultar APIs o documentación.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL completa a consultar (ej: https://api.example.com/data)' },
      format: { type: 'string', enum: ['text', 'markdown'], description: 'Formato de salida (default: text)' },
      timeout: { type: 'number', description: 'Timeout en ms (default: 15000)' }
    },
    required: ['url']
  },
  async execute(args) {
    const { url, format = 'text', timeout = 15000 } = args;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { signal: controller.signal });
      const text = await response.text();
      return { url, status: response.status, content: text };
    } catch (e) {
      throw new Error(`Error al obtener ${url}: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
  }
};
