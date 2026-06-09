const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const SERVER_SCRIPT = path.join(__dirname, '..', 'ahorcado', 'wordsServer.mjs');
const TEST_TIMEOUT = 25000;

let total = 0;
let passed = 0;
let failed = 0;

function test(name, fn) {
    total++;
    const timeout = setTimeout(() => {
        console.log(`  ✗ TIMEOUT: ${name}`);
        failed++;
    }, TEST_TIMEOUT);
    fn().then(() => {
        clearTimeout(timeout);
        passed++;
    }).catch(err => {
        clearTimeout(timeout);
        console.log(`  ✗ ${name}: ${err.message}`);
        failed++;
    });
}

function assert(condition, msg) {
    if (!condition) throw new Error(msg || 'Assertion failed');
}

async function mcpRequest(requestBody) {
    return new Promise((resolve, reject) => {
        const proc = spawn('node', [SERVER_SCRIPT], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, NODE_OPTIONS: '--no-deprecation' }
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

// Test 1: syntax check
test('wordsServer.mjs — sintaxis válida', async () => {
    execSync(`node --check "${SERVER_SCRIPT}"`, { stdio: 'pipe' });
});

// Test 2: spawn server, request tool list, validate response
test('wordsServer.mjs — responde a tools/list vía MCP', async () => {
    const response = await mcpRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
    });

    assert(response.jsonrpc === '2.0', 'Falta jsonrpc field');
    assert(response.id === 1, 'ID no coincide');
    assert(response.result, 'Falta result en respuesta');
    assert(Array.isArray(response.result.tools), 'tools debe ser un array');
    assert(response.result.tools.length > 0, 'Debe haber al menos 1 tool');
    assert(response.result.tools[0].name === 'get_random_word',
        `Tool name debe ser get_random_word, es: ${response.result.tools[0].name}`);
});

// Test 3: call get_random_word tool
test('wordsServer.mjs — ejecuta get_random_word y devuelve palabra', async () => {
    const response = await mcpRequest({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'get_random_word', arguments: {} }
    });

    assert(response.jsonrpc === '2.0', 'Falta jsonrpc field');
    assert(response.id === 2, 'ID no coincide');
    assert(response.result, 'Falta result en respuesta');
    assert(Array.isArray(response.result.content), 'content debe ser un array');
    assert(response.result.content.length > 0, 'content no debe estar vacío');

    const parsed = JSON.parse(response.result.content[0].text);
    assert(typeof parsed.palabra === 'string' && parsed.palabra.length > 0,
        `palabra inválida: ${parsed.palabra}`);
    assert(typeof parsed.definicion === 'string',
        `definicion debe ser string, es: ${typeof parsed.definicion}`);
});

// Test 4: unknown tool returns error
test('wordsServer.mjs — tool desconocida devuelve error', async () => {
    const response = await mcpRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'nonexistent_tool', arguments: {} }
    });

    assert(response.error, 'Se esperaba un error en la respuesta');
    assert(response.error.message.includes('no encontrada'),
        `Mensaje de error inesperado: ${response.error.message}`);
});

// Test 5: mcp.json existe y referencia a wordsServer.mjs
test('mcp.json — contiene la config del servidor de palabras', async () => {
    const ruta = path.join(__dirname, '..', '.agents', 'mcp', 'mcp.json');
    assert(fs.existsSync(ruta), 'mcp.json no existe');

    const config = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    assert(config.mcpServers, 'Falta mcpServers en mcp.json');
    assert(config.mcpServers['api-palabras-espanol'],
        'Falta api-palabras-espanol en mcpServers');

    const serverCfg = config.mcpServers['api-palabras-espanol'];
    assert(serverCfg.command === 'node', `command debe ser "node", es: ${serverCfg.command}`);
    assert(serverCfg.args.includes('ahorcado/wordsServer.mjs'),
        `args debe incluir wordsServer.mjs, args: ${JSON.stringify(serverCfg.args)}`);
});

setTimeout(() => {
    console.log(`\n=== Resultados: ${passed}/${total} tests pasaron`);
    if (failed > 0) {
        console.log(`Fallaron ${failed} tests`);
        process.exit(1);
    }
}, TEST_TIMEOUT + 500);
