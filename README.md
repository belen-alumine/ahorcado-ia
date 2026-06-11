# Ahorcado IA — Capacitación en desarrollo con IA

Este repositorio es parte de una **capacitación práctica en desarrollo de software asistido por inteligencia artificial**. El objetivo es aprender a usar herramientas como **opencode** y agentes autónomos para construir, testear y mantener una aplicación web real, usando un flujo de trabajo iterativo donde la IA propone código, escribe archivos, ejecuta pruebas y se retroalimenta de los errores.

## El proyecto

Un juego del **ahorcado** clásico en el navegador, desarrollado con HTML5, CSS3 y JavaScript vanilla (sin frameworks ni librerías externas en el frontend). El usuario debe adivinar una palabra letra por letra antes de que se complete el dibujo del ahorcado (7 errores máximos). Incluye sistema de puntaje, animaciones con confetti, overlay de resultados y soporte responsive hasta 480px.

### APIs externas

- **Random Words API** (`random-words-api.kushcreates.com`) — obtiene palabras aleatorias en español (vía `?language=es`)
- **Dictionary API** (`api.dictionaryapi.dev`) — obtiene definiciones de palabras
- Si la API de palabras falla, usa una lista local hardcodeada de 30 palabras con definiciones

## Arquitectura

```
cliente (HTML/CSS/JS)  ←→  wordsServer.mjs (HTTP + MCP)
                                ↓
                         APIs externas de palabras
```

El servidor `wordsServer.mjs` corre en Node.js con módulos nativos (`http`, `fs`, `path`) y expone dos interfaces:

1. **HTTP** — sirve los archivos estáticos y el endpoint `/api/random-word` que devuelve `{ palabra, definicion }`
2. **MCP** (Model Context Protocol) — expone la herramienta `get_random_word` para que la IA (opencode) pueda consultar palabras durante el desarrollo

El frontend consume `/api/random-word` al iniciar cada partida y maneja toda la lógica de juego en el navegador.

## Entorno de desarrollo con IA

El proyecto está diseñado para desarrollo asistido por IA en múltiples niveles: desde el asistente interactivo **opencode** hasta un **harness autónomo** que itera sin supervisión, pasando por **sub-agentes** especializados y herramientas **MCP**. Todo se configura desde `opencode.jsonc`.

### opencode

**opencode** es el asistente interactivo (CLI). Lee instrucciones de `AGENTS.md` y está configurado con:

- **Skills** — habilidades cargadas vía `opencode.jsonc` que proveen guías detalladas para tareas específicas:
  - `frontend-design` — interfaces pulidas y creativas
  - `nodejs-backend-patterns` — patrones de servidor Node.js (Express/Fastify, middleware, auth, etc.)
  - `nodejs-best-practices` — principios de diseño, selección de frameworks, async patterns

  Cuando una tarea coincide, opencode inyecta automáticamente las instrucciones de la skill en el contexto.

- **MCP (Model Context Protocol)** — el servidor `wordsServer.mjs` expone la herramienta `get_random_word` vía stdio. opencode puede llamarla durante la sesión para obtener palabras en español con definiciones, útil para generar datos de prueba o verificar el comportamiento del servidor.

- **Comando `/super-commit`** — agrupa cambios no commiteados en commits semánticos y pushea automáticamente.

### Harness de IA autónomo

En `.agents/ia-harness/agent.js` hay un **bucle de desarrollo autónomo** que opera sin intervención humana:

1. **Lee contexto** — recolecta spec, HTML, JS, CSS, server, tests y system prompt
2. **Llama a la IA** — envía todo el contexto a un modelo LLM (vía API compatible con OpenAI, default `big-pickle`)
3. **Aplica cambios** — la IA responde con `{ archivos: [{ archivo, codigo }] }`; el harness escribe cada archivo a disco
4. **Ejecuta tests** — corre secuencialmente `npm test` (Playwright en Chromium) y `npm run test:words-server`
5. **Diagnóstico** — si un test falla, **spawnea el sub-agente debugger** (ver abajo), cuyo diagnóstico se inyecta como feedback en el siguiente ciclo
6. **Itera** — repite hasta 5 intentos. Si todos pasan → éxito. Si se agotan → error con `lastError`
7. La IA puede crear o modificar tests cuando las especificaciones cambian

### Sub-agente debugger

El **debugger autónomo** (`.agents/debugger/debugger.js`) es un script independiente que el harness invoca como sub-proceso cuando los tests fallan. No depende del harness: puede ejecutarse solo con `--error` o por stdin.

**Flujo de diagnóstico:**
1. Recibe el error del test (stdout + stderr + mensaje)
2. Lee los mismos archivos del proyecto que el harness
3. Envía todo a la API con el prompt de `prompt.md`, pidiendo un JSON estructurado
4. Devuelve `{ diagnostico: { tipo_error, archivo, linea, causa, sugerencia, confianza } }`

**Fallbacks:** si la API no responde o el JSON es inválido, devuelve `confianza: "baja"` con un diagnóstico genérico. El harness incorpora el diagnóstico en la sección `=== DIAGNÓSTICO DEL DEBUGGER ===` del siguiente prompt.

### Skills

Las skills se cargan desde `.agents/skills/` y se configuran en `opencode.jsonc`. Son instrucciones especializadas que opencode inyecta cuando detecta una tarea relevante (ej: "mejorá el diseño" → `frontend-design`). No se aplican automáticamente (`autoApply: false`) para no saturar el contexto.

### MCP

El servidor `ahorcado/wordsServer.mjs` implementa MCP (Model Context Protocol) sobre stdio. Se registra en `opencode.jsonc` como un servidor MCP local:

```
{
  "mcp": {
    "api-palabras-espanol": {
      "type": "local",
      "command": ["node", "ahorcado/wordsServer.mjs"],
      "enabled": true
    }
  }
}
```

Esto permite que opencode invoque la herramienta `get_random_word` durante la sesión sin necesidad de llamar a la API externa manualmente.

### Tests

Los tests usan **Playwright** y están en `tests/`:

- `ahorcado.spec.js` — 3 escenarios: victoria perfecta (🏆), derrota (💀) y responsive (480px). Cada ejecución genera screenshots en `tests/screenshots/test_N/` (con contador autoincremental vía `init-screenshots.mjs`).
- `words-server.test.js` — 5 tests del servidor MCP de palabras con el runner `node:test` (peticiones HTTP, MCP, error handling).
- `init-screenshots.mjs` — crea la subcarpeta numerada para los screenshots de la corrida actual.

## Comandos

| Comando | Descripción |
|---------|-------------|
| `node ahorcado/wordsServer.mjs` | Inicia servidor en `http://localhost:3000` |
| `npm test` | Tests de Playwright para el juego |
| `npm run test:chromium` | Tests solo en Chromium |
| `npm run test:words-server` | Tests del servidor MCP |
| `node .agents/ia-harness/agent.js` | Bucle de desarrollo autónomo con IA |
| `/super-commit` (en opencode) | Commits semánticos + push |

## Estructura del repositorio

```
docs/
  index.html          — entrada del juego
  script.js           — lógica del juego
  styles.css          — estilos
ahorcado/
  wordsServer.mjs     — servidor HTTP + MCP de palabras
  spec.md             — especificaciones detalladas
opencode.jsonc         — configuración de opencode (en la raíz)
.opencode/
  commands/
    super-commit.md   — comando personalizado
.agents/
  ia-harness/
    agent.js          — bucle de desarrollo autónomo
    system-prompt.md  — prompt del agente IA
  debugger/
    debugger.js       — sub-agente de diagnóstico de tests
    prompt.md         — prompt del debugger
  mcp/
    mcp.json          — configuración MCP legacy
  skills/             — habilidades para opencode
    frontend-design/
    nodejs-backend-patterns/
    nodejs-best-practices/
tests/
  ahorcado.spec.js    — tests del juego (Playwright)
  words-server.test.js — tests del servidor MCP
```

## Requisitos

- Node.js 18+
- `npm install`
- `npx playwright install chromium` (para tests)
