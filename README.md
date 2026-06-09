# Ahorcado IA — Capacitación en desarrollo con IA

Este repositorio es parte de una **capacitación práctica en desarrollo de software asistido por inteligencia artificial**. El objetivo es aprender a usar herramientas como **opencode** y agentes autónomos para construir, testear y mantener una aplicación web real, usando un flujo de trabajo iterativo donde la IA propone código, escribe archivos, ejecuta pruebas y se retroalimenta de los errores.

## El proyecto

Un juego del **ahorcado** clásico en el navegador, desarrollado con HTML5, CSS3 y JavaScript vanilla (sin frameworks ni librerías externas en el frontend). El usuario debe adivinar una palabra letra por letra antes de que se complete el dibujo del ahorcado (7 errores máximos). Incluye sistema de puntaje, animaciones con confetti, overlay de resultados y soporte responsive hasta 480px.

### APIs externas

- **Random Word API** (`random-word-api.herokuapp.com`) — obtiene palabras aleatorias en español
- **Palabras Aleatorias API** (`palabras-aleatorias-public-api.herokuapp.com`) — fallback alternativo
- **DictionaryAPI** (`api.dictionaryapi.dev`) — definiciones en español
- Si todas fallan, el servidor genera palabras por sílabas aleatorias como fallback local

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

### opencode

El proyecto está configurado con **opencode** como asistente de desarrollo (`opencode.jsonc`). Incluye:

- **Instrucciones** personalizadas vía `AGENTS.md`
- **Comando `/super-commit`** que agrupa cambios en commits semánticos y pushea automáticamente
- **Servidor MCP integrado** (`wordsServer.mjs`) que opencode puede llamar durante la sesión para obtener palabras de prueba

### Harness de IA autónomo

En `.agents/ia-harness/agent.js` hay un **bucle de desarrollo autónomo** que:

1. Lee las especificaciones del juego (`especificaciones.md`)
2. Envía el contexto a un modelo de IA vía API
3. Recibe código generado y lo escribe a disco
4. Ejecuta `node --check` para verificar sintaxis
5. Si hay errores, los incluye en el siguiente ciclo como feedback

### Skills

El directorio `.agents/skills/` contiene habilidades especializadas para opencode que proveen guías detalladas sobre:

- **Accesibilidad web** (WCAG 2.2)
- **Frontend design** — interfaces pulidas
- **Node.js backend patterns** — middlewares, autenticación, APIs
- **Node.js best practices** — principios de diseño
- **SEO** — optimización para buscadores

### Tests

Los tests usan **Playwright** y están en `tests/`:

- `ahorcado.spec.js` — 3 escenarios: victoria perfecta (🏆), derrota (💀) y responsive (480px)
- `words-server.test.js` — tests del servidor MCP de palabras

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
ahorcado/
  index.html          — entrada del juego
  script.js           — lógica del juego
  styles.css          — estilos
  wordsServer.mjs     — servidor HTTP + MCP de palabras
  spec.md             — especificaciones detalladas
.opencode/
  opencode.jsonc      — configuración de opencode
  commands/
    super-commit.md   — comando personalizado
.agents/
  ia-harness/
    agent.js          — bucle de desarrollo autónomo
    system-prompt.md  — prompt del agente IA
  mcp/
    mcp.json          — configuración MCP legacy
  skills/             — habilidades para opencode
tests/
  ahorcado.spec.js    — tests del juego (Playwright)
  words-server.test.js — tests del servidor MCP
```

## Requisitos

- Node.js 18+
- `npm install`
- `npx playwright install chromium` (para tests)
