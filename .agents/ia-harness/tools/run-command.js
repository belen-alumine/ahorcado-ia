const { execSync } = require('child_process');

const ALLOWED_PREFIXES = ['npm', 'node', 'npx', 'ls', 'dir', 'cat', 'type', 'echo', 'mkdir', 'pwsh', 'powershell'];

module.exports = {
  name: 'run_command',
  description: 'Ejecuta un comando en el terminal del proyecto. Solo comandos seguros están permitidos (npm, node, npx, ls, cat, echo, mkdir). Para comandos arbitrarios, usar con precaución.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Comando a ejecutar' },
      timeout: { type: 'number', description: 'Timeout en ms (default: 30000)' }
    },
    required: ['command']
  },
  async execute(args, { projectDir }) {
    const { command, timeout = 30000 } = args;
    const cmdTrimmed = command.trim();
    const isAllowed = ALLOWED_PREFIXES.some(p => cmdTrimmed.startsWith(p));
    if (!isAllowed) {
      return { error: `Comando no permitido. Prefijos permitidos: ${ALLOWED_PREFIXES.join(', ')}`, blocked: true };
    }
    try {
      const output = execSync(command, {
        cwd: projectDir,
        encoding: 'utf-8',
        timeout,
        stdio: 'pipe',
        maxBuffer: 1024 * 1024
      });
      return { stdout: output.trim(), exitCode: 0 };
    } catch (e) {
      const stdout = e.stdout?.toString().trim() || '';
      const stderr = e.stderr?.toString().trim() || '';
      return { stdout, stderr, exitCode: e.status ?? 1, error: e.message };
    }
  }
};
