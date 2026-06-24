# AGENTS.md

## Proyecto

Juego del ahorcado en `ahorcado/` — HTML + CSS + vanilla JS, sin dependencias externas para el frontend.

## Flujo de trabajo

Cuando el usuario pida un cambio en el código:

### Paso 1 — Analizar el pedido
- Si el pedido es **vago o genérico** (ej: "cambiá los colores", "mejorá el diseño"):
  - Leer archivos relevantes del proyecto para entender el alcance
  - **Repreguntar al usuario** para precisar qué quiere exactamente
- Si el pedido es **específico y detallado** (ej: "cambiá el `background` de `.contenedor` a `#ff0000` en `styles.css`"):
  - No repreguntar, pasar directo a formular instrucción

### Paso 2 — Formular instrucción
- Armar una instrucción clara y contextualizada para el agente
- Incluir archivos a modificar, comportamiento esperado y criterios de éxito
- Si el cambio es trivial (< ~30s de trabajo manual), hacerlo directamente sin invocar agent.js

### Paso 3 — Ejecutar agente o manual
- Verificar si `OPENCODE_API_KEY` existe
- Si existe → ejecutar `node .agents/ia-harness/agent.js "<instrucción formulada>"` con timeout de 180s
  - El harness corre scaffolding automáticamente y luego entra en un tool-calling loop
  - Parsear la última línea de stdout como JSON
  - Si `status === "success"` → informar al usuario y terminar
  - Si el timeout expira o `status === "max_attempts"` → hacer el cambio manualmente
- Si `OPENCODE_API_KEY` no existe → skip directo a manual

## Comandos

- `node ahorcado/wordsServer.mjs` — inicia servidor en `http://localhost:3000` (usar `$env:PORT=3000` en Windows)
- `npm test` — ejecuta tests de Playwright para el juego
- `npm run test:chromium` — tests solo en Chromium
- `npm run test:words-server` — tests del servidor MCP de palabras
- `node .agents/ia-harness/agent.js "<instrucción>"` — bucle de desarrollo asistido por IA con herramientas
- `node .agents/scaffold/check-env.js` — verifica que el entorno esté listo (Node, deps, archivos clave)
- `node .agents/debugger/debugger.js --error "<output>"` — diagnóstico de fallos en tests

## Comandos de opencode

- `/super-commit` — agrupa cambios en commits semánticos y pushea

## Estructura

```
ahorcado/
  index.html          — entrada del juego
  script.js           — lógica del juego
  styles.css          — estilos
  wordsServer.mjs     — servidor HTTP + MCP de palabras
  spec.md             — especificaciones del juego + cómo correr tests
opencode.jsonc           — configuración global del proyecto para opencode (en la raíz)
.opencode/
  commands/
    super-commit.md       — comando /super-commit
.agents/
  ia-harness/
    agent.js              — bucle IA con tool-calling loop y scaffolding
    system-prompt.md      — prompt de sistema para la IA del harness
    security.js           — sistema de seguridad (modos auto/confirm/restricted)
    reviewer.js           — agente revisor post-cambio (tests, secrets, consistencia)
    metrics.js            — métricas y auto-mejora (tracking + actualización de system-prompt)
    tools/
      index.js            — registro central de herramientas
      read-file.js        — tool: leer archivos del proyecto
      write-file.js       — tool: escribir archivos
      edit-file.js        — tool: edición precisa (search-and-replace)
      search-code.js      — tool: búsqueda regex en el código
      run-command.js      — tool: ejecutar comandos (npm, node, npx)
      run-tests.js        — tool: ejecutar suites de test
      read-url.js         — tool: consultar URLs externas
  scaffold/
    check-env.js          — verificación del entorno (Node, deps, archivos clave)
  debugger/
    debugger.js           — diagnóstico autónomo de fallos en tests
    prompt.md             — prompt de sistema del debugger
  mcp/
    mcp.json              — configuración de servidores MCP (legacy, para tests)
tests/
  ahorcado.spec.js        — tests con Playwright
  words-server.test.js    — tests del servidor MCP de palabras
```

## Arquitectura del Harness (Fase 1)

`agent.js` implementa un bucle de agente con herramientas (tool-calling loop):

1. **Scaffolding** — verifica Node.js, dependencias, archivos clave antes de empezar
2. **Contexto mínimo** — envía solo estructura del proyecto + AGENTS.md + spec.md, no todos los archivos
3. **Tool-calling loop** — la IA pide ejecutar herramientas (read_file, write_file, edit_file, search_code, run_command, run_tests, read_url) y el harness ejecuta y devuelve resultados
4. **Memoria** — el historial se trunca a los últimos 10 intercambios para no saturar la ventana de contexto
5. **Seguridad** — herramientas destructivas pasan por `security.js` (modos auto/confirm/restricted)
6. **Revisión** — antes de aceptar `complete`, el `reviewer.js` verifica tests, secretos, archivos clave y sintaxis
7. **Métricas** — cada run se registra en `harness-metrics.ndjson` para tracking y auto-mejora
8. **Verificación** — cuando la IA declara `complete`, el harness corre los tests automáticamente

### Formato de respuesta de la IA

```json
// Para ejecutar herramientas:
{ "reasoning": "...", "tool_calls": [{ "name": "read_file", "arguments": { "path": "docs/script.js" } }] }

// Para indicar finalización:
{ "reasoning": "...", "complete": true, "message": "Implementé X" }
```

## MCP (Model Context Protocol)

El servidor `wordsServer.mjs` expone una herramienta `get_random_word` que devuelve `{ palabra, definicion }`. Se integra con opencode via `opencode.jsonc` (clave `mcp`).

### API externa
- Usa `https://random-words-api.kushcreates.com/api?language=es&type=lowercase&words=1` para palabras
- Si la API de palabras falla, usa una lista local hardcodeada de 30 palabras con definiciones
- `https://api.dictionaryapi.dev/api/v2/entries/es/` para definiciones de palabras de la API; si no responde, usa definición hardcodeada o vacío

## Notas

- No hay build, lint, ni typecheck.
- Las palabras del juego se obtienen del servidor (`/api/random-word`), que consulta una API externa con fallback a lista local.
- Tests: `npm test` (requiere `npm install && npx playwright install chromium`).

## Skills
Las skills `frontend-design` y `nodejs-backend-patterns` están con autoApply:true. Usalas activamente cuando la tarea corresponda.

- `frontend-design` — creación de interfaces pulidas
- `nodejs-backend-patterns` — patrones de servidor Node.js
- `nodejs-best-practices` — principios de diseño Node.js
