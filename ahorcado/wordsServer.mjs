import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ── API externa de palabras ──────────────────────────────────
async function fetchConTimeout(url, ms = 2000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function obtenerPalabraDesdeAPI() {
  try {
    const res = await fetchConTimeout("https://random-word-api.herokuapp.com/word?lang=es&number=5");
    if (res.ok) {
      const palabras = await res.json();
      if (Array.isArray(palabras) && palabras.length > 0) {
        return palabras[Math.floor(Math.random() * palabras.length)];
      }
    }
  } catch {}

  try {
    const res = await fetchConTimeout("https://palabras-aleatorias-public-api.herokuapp.com/random");
    if (res.ok) {
      const data = await res.json();
      if (data?.body) return data.body;
    }
  } catch {}

  return null;
}

async function obtenerDefinicion(palabra) {
  try {
    const res = await fetchConTimeout(`https://api.dictionaryapi.dev/api/v2/entries/es/${palabra}`);
    if (res.ok) {
      const data = await res.json();
      return data[0]?.meanings?.[0]?.definitions?.[0]?.definition || "";
    }
  } catch {}
  return "";
}

// ── Servidor HTTP ────────────────────────────────────────────
http.createServer(async (req, res) => {
  if (req.url === '/api/random-word') {
    let palabra = await obtenerPalabraDesdeAPI();

    if (!palabra) {
      // Fallback: palabra aleatoria generada
      const silabas = "ba be bi bo bu ca ce ci co cu da de di do du fa fe fi fo fu ga ge gi go gu ha he hi ho hu ja je ji jo ju ka ke ki ko ku la le li lo lu ma me mi mo mu na ne ni no nu pa pe pi po pu ra re ri ro ru sa se si so su ta te ti to tu va ve vi vo vu wa we wi wo wu xa xe xi xo xu ya ye yi yo yu za ze zi zo zu".split(" ");
      palabra = "";
      for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
        palabra += silabas[Math.floor(Math.random() * silabas.length)];
      }
    }

    const definicion = await obtenerDefinicion(palabra);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ palabra, definicion }));
    return;
  }

  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>404 - No encontrado</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.error(`Servidor HTTP en http://localhost:${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') return;
  console.error('Error en servidor HTTP:', err.message);
});

// ── Servidor MCP (Model Context Protocol) ────────────────────
const mcpServer = new Server({
  name: "api-palabras-espanol",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [{
      name: "get_random_word",
      description: "Obtiene una palabra aleatoria en español con su definición desde una API externa, útil para juegos como el ahorcado.",
      inputSchema: { type: "object", properties: {} }
    }]
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "get_random_word") {
    throw new Error("Herramienta no encontrada");
  }

  let palabra = await obtenerPalabraDesdeAPI();

  if (!palabra) {
    const silabas = "ba be bi bo bu ca ce ci co cu da de di do du fa fe fi fo fu ga ge gi go gu ha he hi ho hu ja je ji jo ju ka ke ki ko ku la le li lo lu ma me mi mo mu na ne ni no nu pa pe pi po pu ra re ri ro ru sa se si so su ta te ti to tu va ve vi vo vu wa we wi wo wu xa xe xi xo xu ya ye yi yo yu za ze zi zo zu".split(" ");
    palabra = "";
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      palabra += silabas[Math.floor(Math.random() * silabas.length)];
    }
  }

  const definicion = await obtenerDefinicion(palabra);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ palabra, definicion })
    }]
  };
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
