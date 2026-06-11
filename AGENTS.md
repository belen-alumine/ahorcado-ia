# AGENTS.md

## Proyecto

Juego del ahorcado en `ahorcado/` — HTML + CSS + vanilla JS, sin dependencias externas para el frontend.

## Comandos

- `node ahorcado/wordsServer.mjs` — inicia servidor en `http://localhost:3000` (usar `$env:PORT=3000` en Windows)
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
  wordsServer.mjs     — servidor HTTP + MCP de palabras
  spec.md             — especificaciones del juego + cómo correr tests
opencode.jsonc           — configuración global del proyecto para opencode (en la raíz)
.opencode/
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
