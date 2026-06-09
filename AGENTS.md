# AGENTS.md

## Proyecto

Juego del ahorcado en `ahorcado/` — HTML + CSS + vanilla JS, sin dependencias externas para el frontend.

## Comandos

- `node ahorcado/server.js` — inicia servidor en `http://localhost:3000`
- `npm test` — ejecuta tests de Playwright para el juego
- `npm run test:chromium` — tests solo en Chromium
- `npm run test:words-server` — tests del servidor MCP de palabras
- `node .agents/ia-harness/agent.js` — bucle de desarrollo asistido por IA

## Comandos de opencode

- `/super-commit` — agrupa cambios en commits semánticos y pushea

## Estructura

```
ahorcado/
  index.html          — entrada del juego
  script.js           — lógica del juego
  styles.css          — estilos
  server.js           — servidor HTTP estático (Node.js nativo)
  wordsServer.mjs     — servidor MCP para obtener palabras aleatorias
  spec.md             — especificaciones del juego + cómo correr tests
.opencode/
  opencode.jsonc          — configuración global del proyecto para opencode
  commands/
    super-commit.md       — comando /super-commit
.agents/
  ia-harness/
    agent.js              — bucle IA: lee spec, llama a opencode, escribe código, prueba, reitera
    system-prompt.md      — prompt de sistema para la IA del harness
  mcp/
    mcp.json              — configuración de servidores MCP (legacy, para tests)
tests/
  ahorcado.spec.js        — tests con Playwright
  words-server.test.js    — tests del servidor MCP de palabras
```

## MCP (Model Context Protocol)

El servidor `wordsServer.mjs` expone una herramienta `get_random_word` que devuelve una palabra en español con su definición. Se integra con opencode via `opencode.jsonc` (clave `mcp`).

### API externa
- Usa `https://api.dictionaryapi.dev/api/v2/entries/es/` para definiciones
- Si la API no responde, devuelve la palabra sin definición
- Las palabras se eligen de una lista local hardcodeada

## Notas

- No hay build, lint, ni typecheck.
- Las palabras del juego están hardcodeadas en `script.js`.
- `wordsServer.mjs` tiene su propia lista local que coincide con la del juego.
- Tests: `npm test` (requiere `npm install && npx playwright install chromium`).
