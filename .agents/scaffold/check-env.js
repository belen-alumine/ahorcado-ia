const fs = require('fs/promises');
const path = require('path');

const PROYECTO_DIR = path.resolve(__dirname, '../..');

async function main() {
  const checks = [];

  // Node.js version
  const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
  checks.push({
    name: 'Node.js >= 18',
    ok: nodeMajor >= 18,
    detail: process.version,
    fix: nodeMajor < 18 ? 'Actualizar Node.js a v18 o superior: https://nodejs.org' : null
  });

  // npm dependencies
  try {
    await fs.access(path.join(PROYECTO_DIR, 'node_modules'));
    checks.push({ name: 'npm dependencies (node_modules)', ok: true });
  } catch {
    checks.push({
      name: 'npm dependencies (node_modules)',
      ok: false,
      detail: 'No encontrado',
      fix: 'Ejecutar: npm install'
    });
  }

  // Key files
  const keyFiles = [
    'ahorcado/wordsServer.mjs',
    'docs/index.html',
    'docs/script.js',
    'docs/styles.css',
    'tests/ahorcado.spec.js',
    'tests/words-server.test.js',
    'package.json',
    'AGENTS.md'
  ];
  for (const f of keyFiles) {
    try {
      await fs.access(path.join(PROYECTO_DIR, f));
      checks.push({ name: f, ok: true });
    } catch {
      checks.push({ name: f, ok: false, detail: 'No encontrado', fix: null });
    }
  }

  // Package.json parse (validate JSON)
  try {
    const pkgRaw = await fs.readFile(path.join(PROYECTO_DIR, 'package.json'), 'utf-8');
    JSON.parse(pkgRaw);
    checks.push({ name: 'package.json (JSON válido)', ok: true });
  } catch (e) {
    checks.push({ name: 'package.json (JSON válido)', ok: false, detail: e.message });
  }

  // Provider system check
  try {
    const provs = Object.keys(require(path.join(__dirname, '../ia-harness/providers/index')).PROVIDER_MAP);
    checks.push({ name: `Provider system (${provs.join(', ')})`, ok: true });
  } catch (e) {
    checks.push({ name: 'Provider system', ok: false, detail: e.message });
  }

  // Security layer check
  try {
    require(path.join(__dirname, '../ia-harness/security'));
    checks.push({ name: 'Security layer', ok: true });
  } catch (e) {
    checks.push({ name: 'Security layer', ok: false, detail: e.message });
  }

  // Reviewer agent check
  try {
    require(path.join(__dirname, '../ia-harness/reviewer'));
    checks.push({ name: 'Reviewer agent', ok: true });
  } catch (e) {
    checks.push({ name: 'Reviewer agent', ok: false, detail: e.message });
  }

  // Metrics & auto-improve check
  try {
    require(path.join(__dirname, '../ia-harness/metrics'));
    checks.push({ name: 'Metrics & auto-improve', ok: true });
  } catch (e) {
    checks.push({ name: 'Metrics & auto-improve', ok: false, detail: e.message });
  }

  // Tool system check
  try {
    const tools = require(path.join(__dirname, '../ia-harness/tools/index'));
    const count = tools.tools.length;
    checks.push({ name: `Tool system (${count} herramientas cargadas)`, ok: true });
  } catch (e) {
    checks.push({ name: 'Tool system', ok: false, detail: e.message });
  }

  // Print report
  console.log(`\n📋 Environment Check — ${PROYECTO_DIR}\n`);
  let passed = 0;
  for (const c of checks) {
    if (c.ok) {
      console.log(`  ✅ ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
      passed++;
    } else {
      console.log(`  ❌ ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
      if (c.fix) console.log(`      → ${c.fix}`);
    }
  }

  const failed = checks.length - passed;
  console.log(`\n${passed}/${checks.length} checks pasaron.`);
  if (failed > 0) {
    console.log(`${failed} cheque/s fallaron. Corregí los errores antes de continuar.\n`);
    process.exit(1);
  }
  console.log('✅ Entorno listo.\n');
}

main().catch(err => {
  console.error('Error en scaffolding:', err);
  process.exit(1);
});
