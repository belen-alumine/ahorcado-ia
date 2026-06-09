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

async function obtenerPalabra() {
  try {
    const res = await fetchConTimeout("https://random-words-api.kushcreates.com/api?language=es&type=lowercase&words=1", 10000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0]?.word) {
        const palabra = String(data[0].word).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (/^[a-zñ]+$/.test(palabra) && palabra.length >= 3) {
          console.error(`[API] palabra obtenida: "${palabra}"`);
          return palabra;
        }
      }
    }
    console.error(`[API] respuesta ${res.status}, no se pudo obtener palabra`);
  } catch (e) {
    console.error(`[API] error al consultar API: ${e.message}`);
  }
  return null;
}

async function fetchConTimeout(url, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ── Servidor HTTP ────────────────────────────────────────────
http.createServer(async (req, res) => {
  if (req.url === '/api/random-word') {
    const palabra = await obtenerPalabra();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ palabra }));
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
      description: "Obtiene una palabra aleatoria en español, útil para juegos como el ahorcado.",
      inputSchema: { type: "object", properties: {} }
    }]
  };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "get_random_word") {
    throw new Error("Herramienta no encontrada");
  }

  const palabra = await obtenerPalabra();

  return {
    content: [{
      type: "text",
      text: JSON.stringify({ palabra })
    }]
  };
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
