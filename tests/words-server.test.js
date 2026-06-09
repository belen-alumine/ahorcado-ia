const { describe, test } = require('node:test');
const assert = require('node:assert');
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SERVER_SCRIPT = path.join(__dirname, '..', 'ahorcado', 'wordsServer.mjs');

async function mcpRequest(requestBody) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [SERVER_SCRIPT], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_OPTIONS: '--no-deprecation', PORT: '3099' }
    });

    const rl = readline.createInterface({ input: proc.stdout });
    let responded = false;

    const timer = setTimeout(() => {
      if (!responded) {
        responded = true;
        proc.kill();
        reject(new Error('Timeout esperando respuesta MCP'));
      }
    }, 15000);

    rl.on('line', (line) => {
      if (responded) return;
      responded = true;
      clearTimeout(timer);
      proc.kill();
      try {
        resolve(JSON.parse(line));
      } catch (e) {
        reject(new Error(`Respuesta no es JSON válido: ${line}`));
      }
    });

    proc.on('error', (err) => {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        reject(err);
      }
    });

    proc.stdin.write(JSON.stringify(requestBody) + '\n');
  });
}

describe('wordsServer.mjs', () => {

  test('sintaxis válida', { timeout: 10000 }, () => {
    execSync(`node --check "${SERVER_SCRIPT}"`, { stdio: 'pipe' });
  });

  test('responde a tools/list vía MCP', { timeout: 25000 }, async () => {
    const response = await mcpRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list'
    });

    assert.equal(response.jsonrpc, '2.0', 'Falta jsonrpc field');
    assert.equal(response.id, 1, 'ID no coincide');
    assert.ok(response.result, 'Falta result en respuesta');
    assert.ok(Array.isArray(response.result.tools), 'tools debe ser un array');
    assert.ok(response.result.tools.length > 0, 'Debe haber al menos 1 tool');
    assert.equal(response.result.tools[0].name, 'get_random_word',
      `Tool name debe ser get_random_word, es: ${response.result.tools[0].name}`);
  });

  test('ejecuta get_random_word y devuelve palabra', { timeout: 30000 }, async () => {
    const response = await mcpRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_random_word', arguments: {} }
    });

    assert.equal(response.jsonrpc, '2.0', 'Falta jsonrpc field');
    assert.equal(response.id, 2, 'ID no coincide');
    assert.ok(response.result, 'Falta result en respuesta');
    assert.ok(Array.isArray(response.result.content), 'content debe ser un array');
    assert.ok(response.result.content.length > 0, 'content no debe estar vacío');

    const parsed = JSON.parse(response.result.content[0].text);
    assert.ok(typeof parsed.palabra === 'string' && parsed.palabra.length > 0,
      `palabra inválida: ${parsed.palabra}`);
    assert.ok(typeof parsed.definicion === 'string',
      `definicion debe ser string, es: ${typeof parsed.definicion}`);
  });

  test('tool desconocida devuelve error', { timeout: 25000 }, async () => {
    const response = await mcpRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} }
    });

    assert.ok(response.error, 'Se esperaba un error en la respuesta');
    assert.ok(response.error.message.includes('no encontrada'),
      `Mensaje de error inesperado: ${response.error.message}`);
  });

  test('mcp.json contiene la config del servidor de palabras', { timeout: 10000 }, () => {
    const ruta = path.join(__dirname, '..', '.agents', 'mcp', 'mcp.json');
    assert.ok(fs.existsSync(ruta), 'mcp.json no existe');

    const config = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    assert.ok(config.mcpServers, 'Falta mcpServers en mcp.json');
    assert.ok(config.mcpServers['api-palabras-espanol'],
      'Falta api-palabras-espanol en mcpServers');

    const serverCfg = config.mcpServers['api-palabras-espanol'];
    assert.equal(serverCfg.command, 'node', `command debe ser "node", es: ${serverCfg.command}`);
    assert.ok(serverCfg.args.includes('ahorcado/wordsServer.mjs'),
      `args debe incluir wordsServer.mjs, args: ${JSON.stringify(serverCfg.args)}`);
  });

});
