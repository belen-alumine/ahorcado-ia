import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT, 10) || 3000;

const PALABRAS = [
  { palabra: 'casa', definicion: 'Edificio para habitar' },
  { palabra: 'perro', definicion: 'Animal doméstico de cuatro patas' },
  { palabra: 'gato', definicion: 'Felino doméstico' },
  { palabra: 'sol', definicion: 'Estrella que da luz y calor' },
  { palabra: 'luna', definicion: 'Satélite natural de la Tierra' },
  { palabra: 'mar', definicion: 'Gran masa de agua salada' },
  { palabra: 'flor', definicion: 'Parte de la planta que contiene los órganos reproductores' },
  { palabra: 'nube', definicion: 'Masa de vapor de agua en la atmósfera' },
  { palabra: 'cielo', definicion: 'Espacio sobre la tierra' },
  { palabra: 'nieve', definicion: 'Agua congelada que cae de las nubes' },
  { palabra: 'vida', definicion: 'Estado de actividad de los seres orgánicos' },
  { palabra: 'pan', definicion: 'Alimento hecho con harina y agua' },
  { palabra: 'lobo', definicion: 'Animal mamífero carnívoro' },
  { palabra: 'pez', definicion: 'Animal vertebrado acuático' },
  { palabra: 'rosa', definicion: 'Flor del rosal' },
  { palabra: 'mano', definicion: 'Parte del cuerpo al final del brazo' },
  { palabra: 'pelo', definicion: 'Filamento que crece en la piel' },
  { palabra: 'nido', definicion: 'Estructura donde las aves ponen sus huevos' },
  { palabra: 'oso', definicion: 'Animal mamífero de gran tamaño' },
  { palabra: 'mono', definicion: 'Animal primate' },
  { palabra: 'lago', definicion: 'Gran masa de agua en tierra firme' },
  { palabra: 'toro', definicion: 'Macho de la vaca' },
  { palabra: 'pato', definicion: 'Ave acuática de pico ancho' },
  { palabra: 'cama', definicion: 'Mueble para dormir' },
  { palabra: 'mesa', definicion: 'Mueble con superficie plana' },
  { palabra: 'silla', definicion: 'Asiento con respaldo' },
  { palabra: 'plato', definicion: 'Recipiente para servir comida' },
  { palabra: 'vaso', definicion: 'Recipiente para beber' },
  { palabra: 'libro', definicion: 'Conjunto de hojas impresas' },
  { palabra: 'radio', definicion: 'Medio de comunicación por ondas' },
];

const PALABRAS_MAP = Object.fromEntries(PALABRAS.map(e => [e.palabra, e.definicion]));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function elegirPalabraLocal() {
  return PALABRAS[Math.floor(Math.random() * PALABRAS.length)];
}

async function obtenerDefinicion(palabra) {
  try {
    const res = await fetchConTimeout(`https://api.dictionaryapi.dev/api/v2/entries/es/${encodeURIComponent(palabra)}`, 5000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data[0]?.meanings?.[0]?.definitions?.[0]?.definition) {
        return data[0].meanings[0].definitions[0].definition;
      }
    }
  } catch (e) {
    console.error(`[API] error al obtener definición: ${e.message}`);
  }
  return null;
}

async function obtenerPalabra() {
  try {
    const res = await fetchConTimeout("https://random-words-api.kushcreates.com/api?language=es&type=lowercase&words=1", 10000);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && data[0]?.word) {
        const palabra = String(data[0].word).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (/^[a-zñ]+$/.test(palabra) && palabra.length >= 3) {
          console.error(`[API] palabra obtenida: "${palabra}"`);
          const definicion = await obtenerDefinicion(palabra) || PALABRAS_MAP[palabra] || '';
          return { palabra, definicion };
        }
      }
    }
    console.error(`[API] respuesta ${res.status}, no se pudo obtener palabra`);
  } catch (e) {
    console.error(`[API] error al consultar API: ${e.message}`);
  }
  const fallback = elegirPalabraLocal();
  console.error(`[FALLBACK] usando palabra local: "${fallback.palabra}"`);
  return { palabra: fallback.palabra, definicion: fallback.definicion };
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

http.createServer(async (req, res) => {
  if (req.url === '/api/random-word') {
    const resultado = await obtenerPalabra();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(resultado));
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

  const resultado = await obtenerPalabra();

  return {
    content: [{
      type: "text",
      text: JSON.stringify(resultado)
    }]
  };
});

const transport = new StdioServerTransport();
await mcpServer.connect(transport);
