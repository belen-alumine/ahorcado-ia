const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

const PROYECTO_DIR = path.resolve(__dirname, '../..');
const MAX_ATTEMPTS_BEFORE_ASK = 5;
const userInstruction = process.argv[2] || '';

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
    systemPrompt: path.join(__dirname, 'system-prompt.md'),
    'ahorcado/index.html': path.join(PROYECTO_DIR, 'ahorcado/index.html'),
    'ahorcado/script.js': path.join(PROYECTO_DIR, 'ahorcado/script.js'),
    'ahorcado/styles.css': path.join(PROYECTO_DIR, 'ahorcado/styles.css'),
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

async function startHarness(instruction) {
  const inst = instruction || userInstruction;
  let currentError = null;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS_BEFORE_ASK) {
    attempts++;
    const contextoArchivos = await leerContexto();
    const systemPrompt = await leerSiExiste(path.join(__dirname, 'system-prompt.md'));
    const context = construirPrompt(systemPrompt, contextoArchivos, currentError, inst);

    const propuestaIA = await llamarAIA(context);
    await aplicarCambios(propuestaIA);

    if (propuestaIA.stdout) {
      console.log(propuestaIA.stdout);
    }

    currentError = await ejecutarPruebas();

    if (currentError === null) {
      const output = { status: "success", attempts };
      console.log(JSON.stringify(output));
      process.exit(0);
    } else {
      console.log("Fallaron tests. Reintentando con el error...");
    }
  }

  const output = { status: "max_attempts", attempts: MAX_ATTEMPTS_BEFORE_ASK, lastError: currentError, stdout: "" };
  console.log(JSON.stringify(output));
  process.exit(1);
}

function construirPrompt(systemPrompt, contextoArchivos, errorActual, userInstruction) {
  let prompt = `=== INSTRUCCIONES DEL SISTEMA ===\n${systemPrompt}\n\n`;
  prompt += `=== ARCHIVOS DEL PROYECTO ===\n${contextoArchivos}\n\n`;

  if (userInstruction) {
    prompt += `=== INSTRUCCIÓN DEL USUARIO ===\n${userInstruction}\n\n`;
  }

  if (errorActual) {
    prompt += `=== ERROR EN TESTS ===\n`;
    prompt += `Los tests fallaron con el siguiente resultado:\n${errorActual}\n`;
    prompt += `Tu única prioridad es corregir los archivos necesarios para que los tests pasen.\n`;
  } else {
    prompt += `=== ESTADO ===\nLos tests actuales pasan correctamente.`;
    prompt += ` Podés continuar con el desarrollo según la spec.\n`;
  }

  return prompt;
}

async function llamarAIA(contextoCompleto) {
  const API_URL = process.env.OPENCODE_API_URL || 'http://localhost:11434/v1';
  const API_KEY = process.env.OPENCODE_API_KEY;
  const MODELO = process.env.OPENCODE_MODEL || 'big-pickle';

  if (!API_KEY) {
    console.error('Falta OPENCODE_API_KEY en variables de entorno');
    process.exit(1);
  }

  const url = `${API_URL.replace(/\/+$/, '')}/chat/completions`;
  const configuracion = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: MODELO,
      messages: [
        { role: 'user', content: contextoCompleto }
      ],
      response_format: { type: 'json_object' }
    })
  };

  try {
    const respuesta = await fetch(url, configuracion);
    if (!respuesta.ok) {
      const texto = await respuesta.text();
      throw new Error(`Error en la API (${respuesta.status}): ${texto}`);
    }

    const datos = await respuesta.json();
    const textoRespuesta = datos.choices[0].message.content;
    const respuestaParseada = JSON.parse(textoRespuesta);

    return respuestaParseada;
  } catch (error) {
    console.error("Error al conectar con la API de la IA:", error);
    throw error;
  }
}

async function aplicarCambios(propuesta) {
  const archivos = propuesta.archivos || (propuesta.archivo && propuesta.codigo ? [{ archivo: propuesta.archivo, codigo: propuesta.codigo }] : []);

  if (archivos.length === 0) {
    throw new Error('La respuesta de la IA debe contener "archivos" (array) o "archivo" + "codigo"');
  }

  for (const item of archivos) {
    if (!item.archivo || !item.codigo) {
      throw new Error(`Cada entrada en "archivos" debe tener "archivo" y "codigo"`);
    }
    const rutaDestino = path.resolve(PROYECTO_DIR, item.archivo);
    const dir = path.dirname(rutaDestino);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(rutaDestino, item.codigo, 'utf-8');
    console.log(`Archivo escrito: ${item.archivo}`);
  }
}

async function ejecutarPruebas() {
  const comandos = [
    { cmd: 'npm test -- --project=chromium', label: 'npm test (Playwright)' },
    { cmd: 'npm run test:words-server', label: 'npm run test:words-server' },
  ];

  for (const { cmd, label } of comandos) {
    try {
      const salida = execSync(cmd, {
        cwd: PROYECTO_DIR,
        stdio: 'pipe',
        timeout: 60000,
        env: { ...process.env, CI: 'true' }
      });
      console.log(salida.stdout?.toString() || '');
    } catch (error) {
      const stderr = error.stderr?.toString() || '';
      const stdout = error.stdout?.toString() || '';
      const mensaje = error.message || '';
      return `[${label}]\n${stdout}\n${stderr}\n${mensaje}`.trim();
    }
  }

  return null;
}

module.exports = { startHarness };
