/**
 * Sistema de seguridad del harness.
 *
 * Clasifica herramientas por nivel de riesgo y aplica la política
 * configurada según HARNESS_SECURITY_MODE.
 *
 * Modos:
 *   auto       — permite todo (default, ideal para CI/automático)
 *   confirm    — pregunta al usuario antes de acciones destructivas
 *   restricted — bloquea acciones destructivas, permite solo lectura
 */

const path = require('path');
const fs = require('fs/promises');

const MODOS = ['auto', 'confirm', 'restricted'];
const MODO_DEFAULT = 'auto';

// Definición de riesgo por tool
const TOOL_RISK = {
  read_file:     'safe',
  search_code:   'safe',
  read_url:      'safe',
  run_tests:     'safe',
  write_file:    'medium',
  edit_file:     'medium',
  run_command:   'dangerous'
};

const SECURITY_LOG = 'harness-security.log';

function getModo() {
  const env = (process.env.HARNESS_SECURITY_MODE || MODO_DEFAULT).toLowerCase();
  return MODOS.includes(env) ? env : MODO_DEFAULT;
}

function getRiesgo(toolName) {
  return TOOL_RISK[toolName] || 'safe';
}

/**
 * Verifica si una tool puede ejecutarse según la política actual.
 * @param {string} toolName
 * @param {object} args
 * @param {object} context - { projectDir, logDir }
 * @returns {{ allowed: boolean, reason?: string, confirmRequired?: boolean }}
 */
async function check(toolName, args, context = {}) {
  const modo = getModo();
  const riesgo = getRiesgo(toolName);
  const logDir = context.logDir || context.projectDir || process.cwd();
  const logPath = path.join(logDir, SECURITY_LOG);

  const entry = {
    timestamp: new Date().toISOString(),
    modo,
    tool: toolName,
    args: { ...args },
    riesgo,
    allowed: true
  };

  if (riesgo === 'safe' || modo === 'auto') {
    entry.allowed = true;
    await appendLog(logPath, entry);
    return { allowed: true };
  }

  if (modo === 'restricted') {
    entry.allowed = false;
    entry.reason = `Modo restricted: operaciones de riesgo "${riesgo}" bloqueadas`;
    await appendLog(logPath, entry);
    return { allowed: false, reason: entry.reason };
  }

  // Modo confirm: tools medium requieren confirmación, dangerous también
  if (modo === 'confirm' && (riesgo === 'medium' || riesgo === 'dangerous')) {
    entry.allowed = false;
    entry.confirmRequired = true;
    await appendLog(logPath, entry);
    const desc = toolName === 'write_file'
      ? `Escribir archivo: ${args.path}`
      : toolName === 'edit_file'
      ? `Editar archivo: ${args.path}`
      : toolName === 'run_command'
      ? `Ejecutar comando: ${args.command}`
      : `${toolName}(${JSON.stringify(args)})`;
    return { allowed: false, confirmRequired: true, description: desc };
  }

  entry.allowed = true;
  await appendLog(logPath, entry);
  return { allowed: true };
}

async function appendLog(logPath, entry) {
  try {
    const line = JSON.stringify(entry) + '\n';
    await fs.appendFile(logPath, line, 'utf-8');
  } catch {
    // Si no se puede escribir el log, no bloquear la operación
  }
}

/**
 * Lee el log de seguridad para reportes.
 */
async function readLog(logDir) {
  try {
    const content = await fs.readFile(path.join(logDir, SECURITY_LOG), 'utf-8');
    return content.trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  } catch {
    return [];
  }
}

module.exports = { check, getModo, getRiesgo, readLog, TOOL_RISK, MODOS };
