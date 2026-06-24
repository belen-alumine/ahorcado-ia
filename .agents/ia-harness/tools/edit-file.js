const fs = require('fs/promises');
const path = require('path');

module.exports = {
  name: 'edit_file',
  description: 'Hace un reemplazo exacto de texto en un archivo existente. Similar a search-and-replace. Para cambios grandes, preferir write_file.',
  parameters: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Ruta relativa al proyecto' },
      old_string: { type: 'string', description: 'Texto exacto a reemplazar (debe existir en el archivo)' },
      new_string: { type: 'string', description: 'Texto de reemplazo' }
    },
    required: ['path', 'old_string', 'new_string']
  },
  async execute(args, { projectDir }) {
    const fullPath = path.resolve(projectDir, args.path);
    if (!fullPath.startsWith(projectDir)) {
      throw new Error('Acceso denegado: la ruta está fuera del directorio del proyecto');
    }
    const content = await fs.readFile(fullPath, 'utf-8');
    if (!content.includes(args.old_string)) {
      throw new Error(`El texto a reemplazar no se encontró en ${args.path}`);
    }
    const newContent = content.replace(args.old_string, args.new_string);
    if (newContent === content) {
      return { path: args.path, action: 'no_change' };
    }
    await fs.writeFile(fullPath, newContent, 'utf-8');
    return { path: args.path, action: 'edited' };
  }
};
