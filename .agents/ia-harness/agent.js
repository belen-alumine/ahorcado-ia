const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');
const { getToolDescriptions, getTool } = require('./tools/index');
const { createProvider } = require('./providers/index');
const security = require('./security');
const { review } = require('./reviewer');
const { MetricsTracker, autoImprove } = require('./metrics');

let provider = null;
let metrics = null;

const PROYECTO_DIR = path.resolve(__dirname, '../..');
const MAX_TOOL_CALLS = 30;
const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_HISTORY_EXCHANGES = 10;

const DOC_FILES = ['README.md', 'AGENTS.md', 'ahorcado/spec.md', '.agents/ia-harness/system-prompt.md'];
const SOURCE_PREFIXES = ['docs/', 'ahorcado/', 'tests/', '.agents/', '.opencode/'];
const modifiedFiles = new Set();

// ─── Helpers ────────────────────────────────────────────────

async function readIfExists(ruta) {
  try { return await fs.readFile(ruta, 'utf-8'); }
  catch { return null; }
}

async function getProjectTree(dir = PROYECTO_DIR, prefix = '', depth = 0) {
  if (depth > 3) return '';
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let tree = '';
  const filtered = entries.filter(e =>
    !e.name.startsWith('.') && e.name !== 'node_modules'
  );
  for (let i = 0; i < filtered.length; i++) {
    const e = filtered[i];
    const isLast = i === filtered.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    tree += `${prefix}${connector}${e.name}${e.isDirectory() ? '/' : ''}\n`;
    if (e.isDirectory()) {
      tree += await getProjectTree(
        path.join(dir, e.name),
        prefix + (isLast ? '    ' : '│   '),
        depth + 1
      );
    }
  }
  return tree;
}

// ─── Tool descriptions formatter ────────────────────────────

function formatToolDescriptions() {
  const descs = getToolDescriptions();
  let text = '## Herramientas disponibles\n\n';
  text += 'Respondé con un JSON que contenga tool_calls para ejecutar herramientas, ';
  text += 'o complete: true cuando termines.\n\n';
  for (const t of descs) {
    text += `### ${t.name}\n`;
    text += `${t.description}\n`;
    text += 'Parámetros:\n';
    const props = t.parameters.properties || {};
    const required = t.parameters.required || [];
    for (const [key, val] of Object.entries(props)) {
      const req = required.includes(key) ? ' (requerido)' : ' (opcional)';
      text += `  - ${key}${req}: ${val.description || val.type}\n`;
    }
    text += '\n';
  }
  return text;
}

// ─── Scaffolding ────────────────────────────────────────────

async function runScaffolding() {
  const checks = [];

  const nodeMajor = parseInt(process.version.slice(1).split('.')[0], 10);
  checks.push({ name: 'Node.js >= 18', ok: nodeMajor >= 18, detail: process.version });

  try {
    await fs.access(path.join(PROYECTO_DIR, 'node_modules'));
    checks.push({ name: 'npm dependencies', ok: true });
  } catch {
    checks.push({ name: 'npm dependencies', ok: false, detail: 'Ejecutar: npm install' });
  }

  const keyFiles = [
    'ahorcado/wordsServer.mjs',
    'docs/index.html', 'docs/script.js', 'docs/styles.css',
    'tests/ahorcado.spec.js', 'tests/words-server.test.js'
  ];
  for (const f of keyFiles) {
    try {
      await fs.access(path.join(PROYECTO_DIR, f));
      checks.push({ name: f, ok: true });
    } catch {
      checks.push({ name: f, ok: false, detail: 'No encontrado' });
    }
  }

  try {
    const provs = Object.keys(require('./providers/index').PROVIDER_MAP);
    checks.push({ name: `Provider system (${provs.join(', ')})`, ok: true });
  } catch (e) {
    checks.push({ name: 'Provider system', ok: false, detail: e.message });
  }

  try {
    require('./security');
    checks.push({ name: 'Security layer', ok: true });
  } catch (e) {
    checks.push({ name: 'Security layer', ok: false, detail: e.message });
  }

  try {
    require('./reviewer');
    checks.push({ name: 'Reviewer agent', ok: true });
  } catch (e) {
    checks.push({ name: 'Reviewer agent', ok: false, detail: e.message });
  }

  try {
    require('./metrics');
    checks.push({ name: 'Metrics & auto-improve', ok: true });
  } catch (e) {
    checks.push({ name: 'Metrics & auto-improve', ok: false, detail: e.message });
  }

  const failures = checks.filter(c => !c.ok);
  return { ok: failures.length === 0, checks, failureCount: failures.length };
}

// ─── Test runner ────────────────────────────────────────────

async function runTestsInternal() {
  const suites = [
    { name: 'playwright', command: 'npm test -- --project=chromium' },
    { name: 'words-server', command: 'npm run test:words-server' }
  ];
  const results = [];
  let allPassed = true;
  for (const s of suites) {
    try {
      execSync(s.command, {
        cwd: PROYECTO_DIR, encoding: 'utf-8', timeout: 60000, stdio: 'pipe', maxBuffer: 1024 * 1024
      });
      results.push({ suite: s.name, passed: true });
    } catch (e) {
      allPassed = false;
      const stdout = e.stdout?.toString().trim() || '';
      const stderr = e.stderr?.toString().trim() || '';
      results.push({ suite: s.name, passed: false, output: (stdout || stderr || e.message).slice(0, 2000) });
    }
  }
  return { allPassed, results };
}

// ─── LLM Call (via provider) ─────────────────────────────────

async function callLLM(messages) {
  if (!provider) {
    provider = createProvider();
    console.log(`  🤖 Provider: ${provider.name} | Modelo: ${provider.model || 'default'}`);
  }
  const { content } = await provider.chat({ messages, response_format: { type: 'json_object' } });
  return content;
}

// ─── Memory management ──────────────────────────────────────

function truncateHistory(messages) {
  const system = messages.filter(m => m.role === 'system');
  const initial = messages.length > 1 && messages[1]?.role === 'user' ? [messages[1]] : [];
  const rest = messages.slice(system.length + initial.length);
  const recent = rest.slice(-(MAX_HISTORY_EXCHANGES * 2));
  return [...system, ...initial, ...recent];
}

// ─── Doc validation ─────────────────────────────────────────

function isSourceFile(filePath) {
  return SOURCE_PREFIXES.some(p => filePath.startsWith(p));
}

function isDocFile(filePath) {
  return DOC_FILES.some(d => filePath === d || filePath.endsWith('/' + d));
}

function validateDocsUpdated() {
  const changedSource = [...modifiedFiles].filter(f => isSourceFile(f) && !isDocFile(f));
  if (changedSource.length === 0) return null;

  const changedDocs = [...modifiedFiles].filter(f => isDocFile(f));
  const outdated = DOC_FILES.filter(d => !changedDocs.includes(d) && !changedDocs.includes(d.replace(/^.*\//, '')));

  if (outdated.length === 0) return null;

  return {
    changedSource,
    outdatedDocs: outdated,
    message:
      `Modificaste archivos fuente (${changedSource.join(', ')}), ` +
      `pero estos archivos de documentación no se actualizaron:\n` +
      outdated.map(d => `  - ${d}`).join('\n') +
      `\n\nActualizalos antes de marcar complete.`
  };
}

// ─── Main harness loop ──────────────────────────────────────

async function startHarness(instruction) {
  console.log('🔧 Verificando entorno (scaffolding)...');
  const scaffold = await runScaffolding();
  if (!scaffold.ok) {
    console.error('❌ Scaffolding falló:');
    for (const c of scaffold.checks) if (!c.ok) console.error(`   ✗ ${c.name}: ${c.detail || 'falló'}`);
    console.error('\nCorregí los errores antes de continuar.');
    process.exit(1);
  }
  console.log(`✅ Scaffolding OK (${scaffold.checks.length} checks)\n`);

  metrics = new MetricsTracker({ projectDir: PROYECTO_DIR });

  const systemPrompt = await readIfExists(path.join(__dirname, 'system-prompt.md'));
  const tree = await getProjectTree();
  const spec = await readIfExists(path.join(PROYECTO_DIR, 'ahorcado/spec.md'));
  const agentsMd = await readIfExists(path.join(PROYECTO_DIR, 'AGENTS.md'));

  let initialContext = `## Estructura del proyecto\n\`\`\`\n${tree}\`\`\`\n\n`;
  initialContext += formatToolDescriptions();
  if (spec) initialContext += `## Especificaciones\n${spec}\n\n`;
  if (agentsMd) initialContext += `## Reglas de trabajo\n${agentsMd}\n\n`;
  initialContext += `## Instrucción del usuario\n${instruction}`;

  const messages = [
    { role: 'system', content: systemPrompt || 'Sos un asistente de programación experto.' },
    { role: 'user', content: initialContext }
  ];

  let toolCallCount = 0;
  let consecutiveFailures = 0;

  while (toolCallCount < MAX_TOOL_CALLS) {
    const recentMessages = truncateHistory(messages);
    let responseText;
    try {
      responseText = await callLLM(recentMessages);
    } catch (err) {
      console.error('Error al llamar a la API:', err.message);
      metrics?.recordError('api_error', err.message);
      await metrics?.flush('error');
      return { status: 'error', error: err.message, attempts: toolCallCount };
    }

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      console.error('Error parseando respuesta JSON:', responseText.slice(0, 300));
      return { status: 'error', error: 'Respuesta inválida de la IA' };
    }

    if (parsed.complete) {
      const docIssue = validateDocsUpdated();
      if (docIssue) {
        console.log('📝 Documentación desactualizada, rechazando complete...');
        messages.push({ role: 'user', content: docIssue.message });
        continue;
      }
      console.log('🤖 IA indica que completó. Verificando con tests + revisión...');

      // Review post-cambio
      const reviewResult = await review({ projectDir: PROYECTO_DIR, modifiedFiles: [...modifiedFiles] });
      if (reviewResult.issues) {
        for (const issue of reviewResult.issues) {
          console.error(`  ${issue.severity === 'error' ? '❌' : '⚠️'} ${issue.detail}`);
        }
      }
      if (!reviewResult.passed) {
        console.error('📋 Revisión rechazada. Reintentando...');
        metrics?.recordError('review_rejected', reviewResult.summary);
        messages.push({
          role: 'user',
          content: `La revisión post-cambio encontró problemas:\n${JSON.stringify(reviewResult.issues, null, 2)}\n\nCorregilos antes de marcar complete.`
        });
        continue;
      }

      const testResult = await runTestsInternal();
      if (testResult.allPassed) {
        console.log('✅ Tests OK');
        // Auto-mejora: detectar patrones y actualizar system-prompt
        const improve = await autoImprove(PROYECTO_DIR);
        if (improve.updated) {
          console.log('🧠 Auto-mejora: system-prompt actualizado con nuevas reglas');
        }
        const summary = await metrics?.flush('success');
        return { status: 'success', attempts: toolCallCount, message: parsed.message || '', metrics: summary || undefined };
      }
      const failed = testResult.results.filter(r => !r.passed);
      console.error('❌ Tests fallaron. Reintentando...');
      metrics?.recordError('test_failure', failed.map(f => f.suite).join(', '));
      messages.push({
        role: 'user',
        content: `Los tests fallaron:\n${JSON.stringify(failed, null, 2)}\n\nCorregí los errores. No marques complete hasta que los tests pasen.`
      });
      continue;
    }

    const toolCalls = parsed.tool_calls || [];
    if (toolCalls.length === 0) {
      messages.push({ role: 'assistant', content: responseText });
      continue;
    }

    const results = [];
    for (const tc of toolCalls) {
      toolCallCount++;
      const tool = getTool(tc.name);
      if (!tool) {
        results.push({ name: tc.name, error: `Tool desconocida. Disponibles: ${getToolDescriptions().map(t => t.name).join(', ')}` });
        metrics?.recordToolCall(tc.name, tc.arguments, null, 'Tool desconocida');
        continue;
      }

      // Security check
      const secCheck = await security.check(tc.name, tc.arguments || {}, { projectDir: PROYECTO_DIR });
      if (!secCheck.allowed) {
        const reason = secCheck.reason || `Operación bloqueada por política de seguridad (modo: ${security.getModo()})`;
        console.error(`  🔒 ${tc.name}: ${reason}`);
        results.push({ name: tc.name, error: reason, blocked: true });
        metrics?.recordToolCall(tc.name, tc.arguments, null, reason);
        continue;
      }
      if (secCheck.confirmRequired) {
        // En modo confirm, preguntar al usuario
        console.log(`  🔒 ${tc.name}: ${secCheck.description}`);
        try {
          const readline = require('readline');
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          const answer = await new Promise(resolve => {
            rl.question('  ¿Permitir? (y/N): ', resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== 'y') {
            console.log('  ✗ Operación rechazada por el usuario');
            results.push({ name: tc.name, error: 'Rechazado por el usuario', blocked: true });
            metrics?.recordToolCall(tc.name, tc.arguments, null, 'Rechazado por el usuario');
            continue;
          }
        } catch {
          // Si no hay stdin interactivo, denegar
          results.push({ name: tc.name, error: 'No se pudo confirmar con el usuario', blocked: true });
          metrics?.recordToolCall(tc.name, tc.arguments, null, 'No se pudo confirmar');
          continue;
        }
      }

      try {
        console.log(`  🛠 ${tc.name}(${JSON.stringify(tc.arguments || {})})`);
        if (tc.arguments && tc.arguments.path) {
          modifiedFiles.add(tc.arguments.path);
        }
        const result = await tool.execute(tc.arguments || {}, { projectDir: PROYECTO_DIR, provider });
        results.push({ name: tc.name, result });
        consecutiveFailures = 0;
        metrics?.recordToolCall(tc.name, tc.arguments, result, null);
      } catch (err) {
        console.error(`  ✗ ${tc.name}: ${err.message}`);
        results.push({ name: tc.name, error: err.message });
        consecutiveFailures++;
        metrics?.recordToolCall(tc.name, tc.arguments, null, err.message);
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          metrics?.recordError('max_consecutive_failures', err.message);
          await metrics?.flush('max_attempts');
          return { status: 'max_attempts', attempts: toolCallCount, lastError: err.message };
        }
      }
    }

    messages.push({ role: 'assistant', content: responseText });
    messages.push({ role: 'user', content: JSON.stringify({ tool_results: results }) });
  }

  metrics?.recordError('max_tool_calls', 'Máximo de tool calls alcanzado');
  await metrics?.flush('max_attempts');
  return { status: 'max_attempts', attempts: toolCallCount, lastError: 'Máximo de tool calls alcanzado' };
}

// ─── CLI Entry ──────────────────────────────────────────────

const userInstruction = process.argv[2] || '';

if (require.main === module) {
  if (!userInstruction) {
    console.error('Uso: node agent.js "instrucción para la IA"');
    process.exit(1);
  }
  startHarness(userInstruction)
    .then(output => {
      console.log(JSON.stringify(output));
      if (output.status !== 'success') process.exit(1);
    })
    .catch(err => {
      console.error('Error fatal:', err);
      process.exit(1);
    });
}

module.exports = { startHarness };
