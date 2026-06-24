const { execSync } = require('child_process');

const SUITES = [
  { name: 'playwright', command: 'npm test -- --project=chromium', label: 'Playwright (ahorcado)' },
  { name: 'words-server', command: 'npm run test:words-server', label: 'MCP server (words-server)' }
];

module.exports = {
  name: 'run_tests',
  description: 'Ejecuta las suites de test del proyecto. Si no se especifica suite, corre ambas.',
  parameters: {
    type: 'object',
    properties: {
      suite: {
        type: 'string',
        enum: ['playwright', 'words-server', 'all'],
        description: 'Suite a ejecutar: playwright, words-server, o all (default: all)'
      },
      timeout: { type: 'number', description: 'Timeout en ms por suite (default: 60000)' }
    }
  },
  async execute(args, { projectDir }) {
    const suite = args.suite || 'all';
    const timeout = args.timeout || 60000;
    const suitesToRun = suite === 'all' ? SUITES : SUITES.filter(s => s.name === suite);

    if (suitesToRun.length === 0) {
      return { error: `Suite desconocida: ${suite}. Opciones: playwright, words-server, all` };
    }

    const results = [];
    let allPassed = true;

    for (const s of suitesToRun) {
      try {
        const output = execSync(s.command, {
          cwd: projectDir,
          encoding: 'utf-8',
          timeout,
          stdio: 'pipe',
          maxBuffer: 1024 * 1024
        });
        results.push({ suite: s.name, passed: true, output: output.trim() });
      } catch (e) {
        allPassed = false;
        const stdout = e.stdout?.toString().trim() || '';
        const stderr = e.stderr?.toString().trim() || '';
        results.push({
          suite: s.name,
          passed: false,
          output: stdout || stderr || e.message
        });
      }
    }

    return { allPassed, results };
  }
};
