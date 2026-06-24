const fs = require('fs/promises');
const path = require('path');

module.exports = {
  name: 'read_file',
  description: 'Lee el contenido de un archivo del proyecto. Opcionalmente con offset y limit de líneas para leer archivos grandes en partes.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Ruta relativa al proyecto (ej: docs/script.js)' },
      offset: { type: 'number', description: 'Línea inicial (1-indexed). Si se omite, empieza desde 1.' },
      limit: { type: 'number', description: 'Máximo de líneas a leer. Si se omite, lee todo el archivo.' }
    },
    required: ['path']
  },
  async execute(args, { projectDir }) {
    const fullPath = path.resolve(projectDir, args.path);
    if (!fullPath.startsWith(projectDir)) {
      throw new Error('Acceso denegado: la ruta está fuera del directorio del proyecto');
    }
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    const start = (args.offset || 1) - 1;
    const end = args.limit ? start + args.limit : undefined;
    const slice = lines.slice(start, end);
    return {
      path: args.path,
      totalLines: lines.length,
      startLine: start + 1,
      endLine: start + slice.length,
      content: slice.join('\n')
    };
  }
};
