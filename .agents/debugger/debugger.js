const fs = require('fs/promises');
const path = require('path');

const DEBUGGER_DIR = __dirname;
const PROYECTO_DIR = path.resolve(__dirname, '../..');

async function leerSiExiste(ruta) {
  try {
    return await fs.readFile(ruta, 'utf-8');
  } catch {
    return null;
  }
}

async function leerContexto() {
  const archivos = {
    spec: path.join(PROYECTO_DIR, 'ahorcado/spec.md'),
    'docs/index.html': path.join(PROYECTO_DIR, 'docs/index.html'),
    'docs/script.js': path.join(PROYECTO_DIR, 'docs/script.js'),
    'docs/styles.css': path.join(PROYECTO_DIR, 'docs/styles.css'),
    'ahorcado/wordsServer.mjs': path.join(PROYECTO_DIR, 'ahorcado/wordsServer.mjs'),
    'tests/ahorcado.spec.js': path.join(PROYECTO_DIR, 'tests/ahorcado.spec.js'),
    'tests/words-server.test.js': path.join(PROYECTO_DIR, 'tests/words-server.test.js'),
  };

  const entradas = await Promise.all(
    Object.entries(archivos).map(async ([nombre, ruta]) => {
      const contenido = await leerSiExiste(ruta);
      return { nombre, contenido };
    })
  );

  const contexto = [];
  for (const { nombre, contenido } of entradas) {
    if (contenido !== null) {
      contexto.push(`=== ${nombre} ===\n${contenido}`);
    }
  }
  return contexto.join('\n\n');
}

function mostrarUso() {
  const uso = `Debugger autónomo para tests del Ahorcado IA

USO:
  node .agents/debugger/debugger.js --error "output del test"
  cat error.txt | node .agents/debugger/debugger.js
  node .agents/debugger/debugger.js --help

OPCIONES:
  --error "..."   Error de test a diagnosticar (entre comillas)
  --help          Muestra este mensaje

VARIABLES DE ENTORNO:
  OPENCODE_API_URL   URL base de la API compatible con OpenAI (default: http://localhost:11434/v1)
  OPENCODE_API_KEY   API key (obligatoria)
  OPENCODE_MODEL     Modelo a usar (default: big-pickle)

SALIDA (JSON):
  {
    "diagnostico": {
      "tipo_error": "playwright | server | asercion | compilacion | timeout | otro",
      "archivo": "ruta/al/archivo",
      "linea": 42,
      "causa": "Descripción breve de la causa raíz",
      "sugerencia": "Descripción del fix sugerido",
      "confianza": "alta | media | baja"
    }
  }`;
  console.log(uso);
}

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    mostrarUso();
    process.exit(0);
  }

  const errorIndex = args.indexOf('--error');
  if (errorIndex !== -1 && args[errorIndex + 1]) {
    return args[errorIndex + 1];
  }

  return null;
}

async function leerStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim() || null));
  });
}

async function llamarAPI(contexto) {
  const API_URL = (process.env.OPENCODE_API_URL || 'http://localhost:11434/v1').replace(/\/+$/, '');
  const API_KEY = process.env.OPENCODE_API_KEY;
  const MODELO = process.env.OPENCODE_MODEL || 'big-pickle';

  if (!API_KEY) {
    throw new Error('Falta OPENCODE_API_KEY en variables de entorno');
  }

  const respuesta = await fetch(`${API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODELO,
      messages: [{ role: 'user', content: contexto }],
      response_format: { type: 'json_object' }
    })
  });

  if (!respuesta.ok) {
    const texto = await respuesta.text();
    throw new Error(`Error en la API (${respuesta.status}): ${texto}`);
  }

  const datos = await respuesta.json();
  return datos.choices[0].message.content;
}

async function main() {
  const errorArg = parseArgs();
  const errorStdin = errorArg ? null : await leerStdin();
  const errorTexto = errorArg || errorStdin;

  if (!errorTexto) {
    console.error('Error: debe proporcionar un error via --error o stdin');
    console.error('Use --help para ver el uso.');
    process.exit(1);
  }

  const [prompt, contexto] = await Promise.all([
    leerSiExiste(path.join(DEBUGGER_DIR, 'prompt.md')),
    leerContexto(),
  ]);

  let mensaje = '';
  if (prompt) mensaje += `=== INSTRUCCIONES DEL SISTEMA ===\n${prompt}\n\n`;
  if (contexto) mensaje += `=== ARCHIVOS DEL PROYECTO ===\n${contexto}\n\n`;
  mensaje += `=== ERROR DEL TEST ===\n${errorTexto}`;

  try {
    const respuesta = await llamarAPI(mensaje);
    const parsed = JSON.parse(respuesta);

    if (parsed.diagnostico) {
      console.log(JSON.stringify(parsed));
    } else {
      console.log(JSON.stringify({
        diagnostico: {
          tipo_error: "otro",
          archivo: null,
          linea: null,
          causa: parsed.causa || "Respuesta inesperada del LLM",
          sugerencia: parsed.sugerencia || "Revisar el error manualmente",
          confianza: "baja"
        }
      }));
    }
  } catch {
    console.log(JSON.stringify({
      diagnostico: {
        tipo_error: "otro",
        archivo: null,
        linea: null,
        causa: "No se pudo parsear respuesta del LLM",
        sugerencia: "Revisar el error manualmente y verificar conexión con la API",
        confianza: "baja"
      }
    }));
  }
}

main();
