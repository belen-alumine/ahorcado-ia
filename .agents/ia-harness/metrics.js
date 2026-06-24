/**
 * Sistema de métricas y auto-mejora del harness.
 *
 * Tracking por run:
 *   - Tool calls (cuáles, cuántas, errores)
 *   - Intentos hasta éxito/fracaso
 *   - Duración total
 *   - Errores comunes
 *
 * Auto-mejora:
 *   - Detecta patrones de error recurrentes
 *   - Actualiza system-prompt.md con reglas aprendidas
 */

const fs = require('fs/promises');
const path = require('path');

const METRICS_FILE = 'harness-metrics.ndjson';

class MetricsTracker {
  constructor({ projectDir } = {}) {
    this.projectDir = projectDir || process.cwd();
    this.logPath = path.join(this.projectDir, METRICS_FILE);
    this.startTime = Date.now();
    this.runId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    this.toolCalls = [];
    this.errors = [];
    this.attemptCount = 0;
  }

  recordToolCall(toolName, args, result, error) {
    this.toolCalls.push({
      tool: toolName,
      args: { ...args },
      success: !error,
      error: error || null,
      timestamp: new Date().toISOString()
    });
  }

  recordError(context, message) {
    this.errors.push({
      context,
      message,
      timestamp: new Date().toISOString()
    });
  }

  incrementAttempts() {
    this.attemptCount++;
  }

  async flush(status) {
    const duration = Date.now() - this.startTime;
    const entry = {
      runId: this.runId,
      status,
      durationMs: duration,
      attempts: this.attemptCount,
      toolCallCount: this.toolCalls.length,
      toolsUsed: [...new Set(this.toolCalls.map(t => t.tool))],
      failureCount: this.toolCalls.filter(t => !t.success).length,
      errorCount: this.errors.length,
      timestamp: new Date().toISOString()
    };

    try {
      await fs.appendFile(this.logPath, JSON.stringify(entry) + '\n', 'utf-8');
    } catch {
      // Si no se puede escribir, no bloquear
    }

    return entry;
  }

  async getRecentRuns(count = 5) {
    try {
      const content = await fs.readFile(this.logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-count).map(l => JSON.parse(l));
    } catch {
      return [];
    }
  }

  async getErrorPatterns() {
    const runs = await this.getRecentRuns(20);
    const patterns = [];

    // Herramientas que más fallan
    const toolFailures = {};
    for (const run of runs) {
      for (const tc of run.toolCalls || []) {
        if (!tc.success) {
          toolFailures[tc.tool] = (toolFailures[tc.tool] || 0) + 1;
        }
      }
    }

    // Errores frecuentes por archivo
    const fileErrors = {};
    for (const run of runs) {
      for (const err of run.errors || []) {
        const fileMatch = err.context?.match(/[\w/]+\.\w+/);
        if (fileMatch) {
          fileErrors[fileMatch[0]] = (fileErrors[fileMatch[0]] || 0) + 1;
        }
      }
    }

    if (Object.keys(toolFailures).length > 0) {
      patterns.push({
        type: 'tool_failure_rate',
        detail: toolFailures
      });
    }
    if (Object.keys(fileErrors).length > 0) {
      patterns.push({
        type: 'file_error_rate',
        detail: fileErrors
      });
    }

    return patterns;
  }
}

/**
 * Auto-mejora: actualiza system-prompt.md con reglas aprendidas
 * de patrones de error recurrentes.
 */
async function autoImprove(projectDir) {
  const tracker = new MetricsTracker({ projectDir });
  const patterns = await tracker.getErrorPatterns();
  if (patterns.length === 0) return { updated: false, reason: 'Sin patrones detectados' };

  const systemPromptPath = path.join(projectDir, '.agents/ia-harness/system-prompt.md');
  let content;
  try {
    content = await fs.readFile(systemPromptPath, 'utf-8');
  } catch {
    return { updated: false, reason: 'system-prompt.md no encontrado' };
  }

  let changes = [];
  for (const pattern of patterns) {
    if (pattern.type === 'tool_failure_rate') {
      for (const [tool, count] of Object.entries(pattern.detail)) {
        if (count >= 3 && !content.includes(`Usá ${tool} con cuidado`)) {
          const rule = `\n- **Auto-aprendizaje**: la herramienta \`${tool}\` ha fallado ${count} veces en ejecuciones recientes. Revisá bien los parámetros antes de usarla.`;
          content += rule;
          changes.push(`Regla añadida para ${tool} (${count} fallos)`);
        }
      }
    }
  }

  if (changes.length === 0) return { updated: false, reason: 'Sin nuevos patrones para incorporar' };

  await fs.writeFile(systemPromptPath, content, 'utf-8');
  return { updated: true, changes };
}

module.exports = { MetricsTracker, autoImprove };
