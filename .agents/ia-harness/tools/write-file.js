const fs = require('fs/promises');
const path = require('path');

module.exports = {
  name: 'write_file',
  description: 'Escribe (o sobrescribe) un archivo completo en el proyecto. Usar con cuidado: reemplaza todo el contenido existente. Para cambios pequeños, preferir edit_file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Ruta relativa al proyecto (ej: docs/script.js)' },
      content: { type: 'string', description: 'Contenido completo del archivo a escribir' }
    },
    required: ['path', 'content']
  },
  async execute(args, { projectDir }) {
    const fullPath = path.resolve(projectDir, args.path);
    if (!fullPath.startsWith(projectDir)) {
      throw new Error('Acceso denegado: la ruta está fuera del directorio del proyecto');
    }
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(fullPath, args.content, 'utf-8');
    return { path: args.path, size: args.content.length, action: 'written' };
  }
};
