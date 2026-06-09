const fs = require('fs/promises');
const path = require('path');
const { execSync } = require('child_process');

function cargarEnv() {
    const ruta = path.join(__dirname, '../../.env');
    try {
        const contenido = fs.readFileSync(ruta, 'utf-8');
        for (const linea of contenido.split('\n')) {
            const trimmed = linea.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx === -1) continue;
            const key = trimmed.slice(0, idx).trim();
            const val = trimmed.slice(idx + 1).trim();
            if (!process.env[key]) {
                process.env[key] = val;
            }
        }
    } catch {
        // .env no existe, se usan las variables de entorno del sistema
    }
}

cargarEnv();

const API_URL = process.env.OPENCODE_API_URL || 'http://localhost:11434/v1';
const API_KEY = process.env.OPENCODE_API_KEY;
const MODELO = process.env.OPENCODE_MODEL || 'big-pickle';

if (!API_KEY) {
    console.error('Falta OPENCODE_API_KEY en .env o en variables de entorno');
    process.exit(1);
}

async function startHarness() {
    let currentError = null;
    let activeLoop = true;

    while (activeLoop) {
        const context = await setContext(currentError);
        const propuestaIA = await llamarAIA(context);

        await aplicarCambios(propuestaIA);
        currentError = await ejecutarPruebas();

        if (currentError === null) {
            console.log("¡El código compiló y corrió sin errores de sintaxis!");
            activeLoop = false;
        } else {
            console.log("Falló el test. Reintentando con el error...");
        }
    }
}

async function setContext(errorActual) {
    try {
        const rutaSpec = path.join(__dirname, '../../especificaciones.md');
        const rutaPrompt = path.join(__dirname, 'system-prompt.md');
        const rutaAppJs = path.join(__dirname, '../../app.js');

        const especificaciones = await fs.readFile(rutaSpec, 'utf-8');
        const systemPrompt = await fs.readFile(rutaPrompt, 'utf-8');

        let codigoActual = '// Aún no se ha escrito código.';
        try {
            codigoActual = await fs.readFile(rutaAppJs, 'utf-8');
        } catch (e) {
            // Si el archivo no existe, se queda con el mensaje inicial
        }

        let contexto = `=== INSTRUCCIONES DEL SISTEMA ===\n${systemPrompt}\n\n`;
        contexto += `=== ESPECIFICACIONES DEL JUEGO ===\n${especificaciones}\n\n`;
        contexto += `=== CÓDIGO ACTUAL DEL PROYECTO (app.js) ===\n${codigoActual}\n\n`;

        if (errorActual) {
            contexto += `=== ¡ALERTA: EL CÓDIGO TIENE UN ERROR! ===\n`;
            contexto += `La terminal devolvió el siguiente error al intentar correr tu código. `;
            contexto += `Tu única prioridad absoluta es corregir esto:\n${errorActual}\n`;
        } else {
            contexto += `=== ESTADO ===\nEl código actual no presenta errores de sintaxis conocidos. Podés continuar con las especificaciones.\n`;
        }

        return contexto;

    } catch (error) {
        console.error("Error crítico en el harness al intentar leer los archivos:", error);
        throw error;
    }
}

async function llamarAIA(contextoCompleto) {
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
    const rutaAppJs = path.join(__dirname, '../../app.js');

    if (!propuesta.archivo || !propuesta.codigo) {
        throw new Error('La respuesta de la IA debe contener "archivo" y "codigo"');
    }

    const rutaDestino = propuesta.archivo === 'app.js'
        ? rutaAppJs
        : path.join(__dirname, '../..', propuesta.archivo);

    const dir = path.dirname(rutaDestino);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(rutaDestino, propuesta.codigo, 'utf-8');

    console.log(`Archivo escrito: ${propuesta.archivo}`);
}

async function ejecutarPruebas() {
    const rutaAppJs = path.join(__dirname, '../../app.js');

    try {
        await fs.access(rutaAppJs);
    } catch {
        return 'app.js no existe aún.';
    }

    try {
        execSync(`node --check "${rutaAppJs}"`, { stdio: 'pipe' });
        return null;
    } catch (error) {
        return error.stderr.toString() || error.message;
    }
}

module.exports = { startHarness };
