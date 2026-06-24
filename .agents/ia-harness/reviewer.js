/**
 * Agente revisor autónomo.
 *
 * Se ejecuta después de cambios para verificar:
 * 1. Tests pasan (Playwright + words-server)
 * 2. No hay secretos/API keys en el código
 * 3. Archivos clave existen
 * 4. Consistencia básica (no hay imports rotos, etc.)
 *
 * Modo de uso:
 *   const { review } = require('./reviewer');
 *   const result = await review({ projectDir, modifiedFiles });
 */

const { execSync } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

// Patrones de secretos a buscar en archivos modificados
const SECRET_PATTERNS = [
  { regex: /(?:api[_-]?key|apikey|secret|token|password)\s*[:=]\s*['"](?!\*|env)/i, label: 'API key/secret hardcodeada' },
  { regex: /sk-[a-zA-Z0-9]{20,}/, label: 'OpenAI API key (sk-)' },
  { regex: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, label: 'Clave privada' },
  { regex: /ghp_[a-zA-Z0-9]{36}/, label: 'GitHub personal access token' },
  { regex: /AKIA[0-9A-Z]{16}/, label: 'AWS access key' },
];

async function review({ projectDir, modifiedFiles = [] }) {
  const issues = [];

  // 1. Run tests
  const testResult = await runTests(projectDir);
  if (!testResult.allPassed) {
    issues.push({
      type: 'test_failure',
      severity: 'error',
      detail: 'Los tests no pasan',
      suites: testResult.results.filter(r => !r.passed).map(r => r.suite)
    });
  }

  // 2. Check secrets in modified files
  for (const filePath of modifiedFiles) {
    try {
      const fullPath = path.resolve(projectDir, filePath);
      if (!fullPath.startsWith(projectDir)) continue;
      const content = await fs.readFile(fullPath, 'utf-8');
      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(content)) {
          issues.push({
            type: 'secret_leak',
            severity: 'error',
            file: filePath,
            detail: `Posible ${pattern.label} encontrada en ${filePath}`
          });
        }
      }
    } catch {
      // Si no se puede leer el archivo, ignorar
    }
  }

  // 3. Check key files exist
  const keyFiles = [
    'docs/index.html', 'docs/script.js', 'docs/styles.css',
    'ahorcado/wordsServer.mjs',
    'tests/ahorcado.spec.js', 'tests/words-server.test.js',
    'package.json'
  ];
  for (const f of keyFiles) {
    try {
      await fs.access(path.join(projectDir, f));
    } catch {
      issues.push({
        type: 'missing_file',
        severity: 'warning',
        file: f,
        detail: `Archivo clave faltante: ${f}`
      });
    }
  }

  // 4. Quick consistency: verify server JS syntax
  try {
    const serverPath = path.join(projectDir, 'ahorcado/wordsServer.mjs');
    await fs.access(serverPath);
    execSync(`node --check "${serverPath}"`, { stdio: 'pipe', timeout: 5000 });
  } catch (e) {
    issues.push({
      type: 'syntax_error',
      severity: 'error',
      file: 'ahorcado/wordsServer.mjs',
      detail: `Error de sintaxis: ${e.message}`
    });
  }

  const passed = issues.filter(i => i.severity === 'error').length === 0;

  return {
    passed,
    summary: passed
      ? '✅ Revisión aprobada: tests OK, sin secretos, archivos clave presentes, sintaxis válida.'
      : `❌ Revisión rechazada: ${issues.length} problema(s) encontrado(s).`,
    issues: issues.length > 0 ? issues : undefined
  };
}

async function runTests(projectDir) {
  const suites = [
    { name: 'playwright', command: 'npm test -- --project=chromium' },
    { name: 'words-server', command: 'npm run test:words-server' }
  ];
  const results = [];
  let allPassed = true;
  for (const s of suites) {
    try {
      execSync(s.command, {
        cwd: projectDir, encoding: 'utf-8', timeout: 60000, stdio: 'pipe', maxBuffer: 1024 * 1024
      });
      results.push({ suite: s.name, passed: true });
    } catch (e) {
      allPassed = false;
      results.push({ suite: s.name, passed: false, output: (e.stderr?.toString() || e.stdout?.toString() || e.message).slice(0, 1000) });
    }
  }
  return { allPassed, results };
}

module.exports = { review };
