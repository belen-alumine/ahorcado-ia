const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

// Ruta raíz del proyecto (dos niveles arriba desde .agents/ia-harness/)
const PROYECTO_DIR = path.resolve(__dirname, '../..');

// Intentos máximos del bucle IA antes de rendirse
const MAX_ATTEMPTS_BEFORE_ASK = 5;

// Instrucción opcional pasada por CLI: node agent.js "tu instrucción"
const userInstruction = process.argv[2] || '';

// Lee un archivo si existe, devuelve null si no
async function leerSiExiste(ruta) {
  try {
    return await fs.readFile(ruta, 'utf-8');
  } catch {
    return null;
  }
}

// Recolecta el contenido de todos los archivos del proyecto para dárselo
// como contexto a la IA en cada ciclo
async function leerContexto() {
  const archivos = {
    spec: path.join(PROYECTO_DIR, 'ahorcado/spec.md'),
    systemPrompt: path.join(__dirname, 'system-prompt.md'),
    'docs/index.html': path.join(PROYECTO_DIR, 'docs/index.html'),
    'docs/script.js': path.join(PROYECTO_DIR, 'docs/script.js'),
    'docs/styles.css': path.join(PROYECTO_DIR, 'docs/styles.css'),
    'ahorcado/wordsServer.mjs': path.join(PROYECTO_DIR, 'ahorcado/wordsServer.mjs'),
    'tests/ahorcado.spec.js': path.join(PROYECTO_DIR, 'tests/ahorcado.spec.js'),
    'tests/words-server.test.js': path.join(PROYECTO_DIR, 'tests/words-server.test.js'),
  };

  // Lee todos los archivos en paralelo
  const entradas = await Promise.all(
    Object.entries(archivos).map(async ([nombre, ruta]) => {
      const contenido = await leerSiExiste(ruta);
      return { nombre, contenido };
    })
  );

  // Arma un string consolidado con separadores visibles para la IA
  const contexto = [];
  for (const { nombre, contenido } of entradas) {
    if (contenido !== null) {
      contexto.push(`=== ${nombre} ===\n${contenido}`);
    }
  }
  return contexto.join('\n\n');
}

// Bucle principal: IA → código → tests → feedback → repetir
async function startHarness(instruction) {
  const inst = instruction || userInstruction;
  let currentError = null;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS_BEFORE_ASK) {
    attempts++;
    const contextoArchivos = await leerContexto();
    const systemPrompt = await leerSiExiste(path.join(__dirname, 'system-prompt.md'));
    const context = construirPrompt(systemPrompt, contextoArchivos, currentError, inst);

    // 1) Pide a la IA que genere/modifique archivos
    const propuestaIA = await llamarAIA(context);

    // 2) Escribe en disco los archivos que la IA devuelva
    await aplicarCambios(propuestaIA);

    // Si la IA incluyó un mensaje para mostrar, lo imprime
    if (propuestaIA.stdout) {
      console.log(propuestaIA.stdout);
    }

    // 3) Ejecuta las suites de test; si fallan, devuelve el error como string
    currentError = await ejecutarPruebas();

    // 4) Sin errores → éxito. Con errores → feedback al siguiente ciclo.
    if (currentError === null) {
      const output = { status: "success", attempts };
      console.log(JSON.stringify(output));
      process.exit(0);
    } else {
      console.log("Fallaron tests. Reintentando con el error...");
    }
  }

  // Se agotaron los intentos sin lograr que todos los tests pasen
  const lastError = typeof currentError === 'object' && currentError !== null
    ? currentError.error || JSON.stringify(currentError)
    : currentError;
  const output = { status: "max_attempts", attempts: MAX_ATTEMPTS_BEFORE_ASK, lastError, stdout: "" };
  console.log(JSON.stringify(output));
  process.exit(1);
}

// Construye el prompt final que se envía a la IA
function construirPrompt(systemPrompt, contextoArchivos, errorActual, userInstruction) {
  let prompt = `=== INSTRUCCIONES DEL SISTEMA ===\n${systemPrompt}\n\n`;
  prompt += `=== ARCHIVOS DEL PROYECTO ===\n${contextoArchivos}\n\n`;

  // Instrucción opcional del usuario (pasa por CLI)
  if (userInstruction) {
    prompt += `=== INSTRUCCIÓN DEL USUARIO ===\n${userInstruction}\n\n`;
  }

  // Si hay un error de tests previo, la IA debe priorizar corregirlo
  if (errorActual) {
    // Si errorActual es un objeto con diagnostico (del debugger)
    if (typeof errorActual === 'object' && errorActual.diagnostico) {
      const d = errorActual.diagnostico;
      prompt += `=== DIAGNÓSTICO DEL DEBUGGER ===\n`;
      prompt += `Tipo: ${d.tipo_error}\n`;
      if (d.archivo) prompt += `Archivo: ${d.archivo}${d.linea ? `:${d.linea}` : ''}\n`;
      prompt += `Causa: ${d.causa}\n`;
      prompt += `Sugerencia: ${d.sugerencia}\n`;
      prompt += `Confianza: ${d.confianza}\n`;
      prompt += `=== ERROR ORIGINAL ===\n${errorActual.error}\n`;
    } else {
      const errorStr = typeof errorActual === 'string' ? errorActual : errorActual.error || String(errorActual);
      prompt += `=== ERROR EN TESTS ===\n`;
      prompt += `Los tests fallaron con el siguiente resultado:\n${errorStr}\n`;
    }
    prompt += `Tu única prioridad es corregir los archivos necesarios para que los tests pasen.\n`;
  } else {
    prompt += `=== ESTADO ===\nLos tests actuales pasan correctamente.`;
    prompt += ` Podés continuar con el desarrollo según la spec.\n`;
  }

  return prompt;
}

// Llama a la API compatible con OpenAI (por defecto Ollama en localhost:11434)
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
      // Fuerza a la IA a responder con un JSON válido
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

// Recibe el objeto { archivos: [{ archivo, codigo }] } de la IA
// y escribe cada archivo en disco (creando directorios si es necesario)
async function aplicarCambios(propuesta) {
  // Soporta tanto array como objeto único por retrocompatibilidad
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

// Ejecuta ambas suites de test secuencialmente.
// Devuelve null si todas pasan, o un objeto { error, diagnostico }
// con el error del test y el diagnóstico del debugger.
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
      const errorStr = `[${label}]\n${stdout}\n${stderr}\n${mensaje}`.trim();

      // Spawn debugger para obtener un diagnóstico estructurado
      try {
        const debuggerPath = path.join(PROYECTO_DIR, '.agents/debugger/debugger.js');
        const debuggerOut = execSync(
          `node "${debuggerPath}" --error ${JSON.stringify(errorStr)}`,
          { cwd: PROYECTO_DIR, stdio: 'pipe', timeout: 30000, env: { ...process.env } }
        );
        const parsed = JSON.parse(debuggerOut.toString());
        return { error: errorStr, diagnostico: parsed.diagnostico || null };
      } catch {
        return { error: errorStr, diagnostico: null };
      }
    }
  }

  return null;
}

module.exports = { startHarness };
