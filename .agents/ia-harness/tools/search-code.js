const { execSync } = require('child_process');
const path = require('path');

module.exports = {
  name: 'search_code',
  description: 'Busca un patrón de texto dentro de los archivos del proyecto usando regex. Útil para encontrar definiciones de funciones, variables, imports, etc.',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Patrón regex a buscar (ej: function\s+\w+, const\s+\w+)' },
      include: { type: 'string', description: 'Filtro de archivos (ej: *.js, *.{js,css})' },
      max_results: { type: 'number', description: 'Máximo de resultados a devolver (default: 20)' }
    },
    required: ['pattern']
  },
  async execute(args, { projectDir }) {
    const { pattern, include, max_results = 20 } = args;
    let cmd = `rg -n "${pattern.replace(/"/g, '\\"')}" --max-count ${max_results}`;
    if (include) cmd += ` -g "${include}"`;
    cmd += ` -g "!node_modules" -g "!.git" -g "!.opencode"`;
    try {
      const output = execSync(cmd, { cwd: projectDir, encoding: 'utf-8', timeout: 15000, stdio: 'pipe' });
      const lines = output.trim().split('\n').filter(Boolean);
      return { matches: lines.length > 0 ? lines.slice(0, max_results) : [], total: lines.length };
    } catch (e) {
      if (e.status === 1 && e.stdout) {
        const lines = e.stdout.trim().split('\n').filter(Boolean);
        return { matches: lines.slice(0, max_results), total: lines.length };
      }
      return { matches: [], total: 0, error: 'No se encontraron coincidencias' };
    }
  }
};
