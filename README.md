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

### Provider de LLM (abstracción polimórfica)

El harness abstrae el modelo de IA detrás de una **interfaz de provider** (`providers/index.js`). Cada provider implementa `chat({ messages, response_format })` — el harness no sabe ni le importa qué API hay detrás.

| Provider | Variable de entorno | Uso |
|----------|-------------------|-----|
| `openai` | `LLM_PROVIDER=openai` (default) | OpenAI API y compatibles (Ollama, LM Studio) |
| `anthropic` | `LLM_PROVIDER=anthropic` | Anthropic Claude |

Configuración vía entorno:
- `LLM_PROVIDER` — selecciona el provider (`openai` | `anthropic`)
- `OPENCODE_API_URL` — URL base de la API (para OpenAI/compatibles)
- `OPENCODE_API_KEY` — API key; para Anthropic: `anthropic:<key>` o `ANTHROPIC_API_KEY`
- `OPENCODE_MODEL` / `ANTHROPIC_MODEL` — nombre del modelo

### Harness de IA autónomo (tool-calling loop)

En `.agents/ia-harness/agent.js` hay un **bucle de agente con herramientas** que opera sin intervención humana:

1. **Scaffolding** — verifica Node.js, dependencias, archivos clave antes de empezar
2. **Contexto mínimo** — envía solo estructura del proyecto + AGENTS.md + spec.md (no todos los archivos)
3. **Tool-calling loop** — la IA pide ejecutar herramientas (read_file, write_file, edit_file, search_code, run_command, run_tests, read_url) y el harness ejecuta y devuelve resultados
4. **Memoria** — el historial se trunca a los últimos 10 intercambios para no saturar la ventana de contexto
5. **Provider abstracto** — usa el provider configurado (OpenAI o Anthropic) indistintamente
6. **Validación de documentación** — si se modifican archivos fuente sin actualizar la doc correspondiente, el harness rechaza el `complete`
7. **Verificación** — cuando la IA declara `complete`, el harness corre los tests automáticamente

La IA responde con JSON:
```json
// Para ejecutar herramientas:
{ "reasoning": "...", "tool_calls": [{ "name": "read_file", "arguments": { "path": "docs/script.js" } }] }

// Para indicar finalización:
{ "reasoning": "...", "complete": true, "message": "Implementé X" }
```

### Sub-agente debugger

El **debugger autónomo** (`.agents/debugger/debugger.js`) es un script independiente para diagnosticar fallos en tests. Se usa desde el harness o standalone. Recibe el error del test, lee los archivos del proyecto y envía todo a la API con el prompt de `prompt.md` para obtener un diagnóstico JSON estructurado.

**Uso:**
```
node .agents/debugger/debugger.js --error "output del test"
```

**Salida:** `{ diagnostico: { tipo_error, archivo, linea, causa, sugerencia, confianza } }`

**Fallbacks:** si la API no responde o el JSON es inválido, devuelve `confianza: "baja"` con diagnóstico genérico.

### Sistema de seguridad

`security.js` clasifica cada herramienta por nivel de riesgo y aplica la política configurada vía `HARNESS_SECURITY_MODE`:

| Modo | Comportamiento |
|------|---------------|
| `auto` (default) | Permite todo, ideal para CI |
| `confirm` | Pregunta al usuario antes de operaciones destructivas (`write_file`, `edit_file`, `run_command`) |
| `restricted` | Bloquea operaciones destructivas, solo permite lectura |

Todas las operaciones se registran en `harness-security.log` con timestamp, tool, argumentos y si fueron permitidas o bloqueadas.

### Agente revisor

`reviewer.js` se ejecuta automáticamente cuando la IA declara `complete: true`. Verifica:

1. **Tests** — ejecuta ambas suites (Playwright + words-server)
2. **Secretos** — busca patrones de API keys, tokens, claves privadas en archivos modificados
3. **Archivos clave** — confirma que los archivos esenciales del proyecto existen
4. **Sintaxis** — verifica que `wordsServer.mjs` tenga sintaxis válida

Si alguna verificación falla, el harness rechaza el `complete` y pide correcciones.

### Métricas y auto-mejora

`metrics.js` trackea cada ejecución del harness y escribe un registro estructurado en `harness-metrics.ndjson`:

- Tool calls (cuáles, cuántas, errores)
- Intentos hasta éxito/fracaso
- Duración total
- Errores comunes

Al finalizar exitosamente, `autoImprove()` analiza los últimos 20 runs. Si detecta patrones de error recurrentes (ej: una tool falla 3+ veces), agrega reglas aprendidas al `system-prompt.md` para evitar que se repitan.

### Skills

Las skills se cargan desde `.agents/skills/` y se configuran en `opencode.jsonc`. Son instrucciones especializadas que opencode inyecta cuando detecta una tarea relevante (ej: "mejorá el diseño" → `frontend-design`). `frontend-design` y `nodejs-backend-patterns` tienen `autoApply: true` para aplicarse automáticamente cuando la tarea corresponde.

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
| `node .agents/ia-harness/agent.js "<instrucción>"` | Bucle de desarrollo autónomo con IA y herramientas |
| `node .agents/scaffold/check-env.js` | Verifica que el entorno esté listo (Node, deps, archivos clave) |
| `node .agents/debugger/debugger.js --error "<output>"` | Diagnóstico de fallos en tests |
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
    agent.js              — bucle IA con tool-calling loop y scaffolding
    system-prompt.md      — prompt de sistema para la IA del harness
    security.js           — sistema de seguridad (modos auto/confirm/restricted)
    reviewer.js           — agente revisor post-cambio (tests, secrets, consistencia)
    metrics.js            — métricas y auto-mejora (tracking + actualización de rules)
    tools/
      index.js            — registro central de herramientas
      read-file.js        — tool: leer archivos del proyecto
      write-file.js       — tool: escribir archivos
      edit-file.js        — tool: edición precisa (search-and-replace)
      search-code.js      — tool: búsqueda regex en el código
      run-command.js      — tool: ejecutar comandos (npm, node, npx)
      run-tests.js        — tool: ejecutar suites de test
      read-url.js         — tool: consultar URLs externas
    providers/
      index.js            — fábrica de providers
      base.js             — interfaz base LLMProvider
      openai.js           — provider OpenAI/compatible
      anthropic.js        — provider Anthropic Claude
  scaffold/
    check-env.js          — verificación del entorno (Node, deps, archivos clave)
  debugger/
    debugger.js           — diagnóstico autónomo de fallos en tests
    prompt.md             — prompt de sistema del debugger
  mcp/
    mcp.json              — configuración MCP legacy
  skills/                 — habilidades para opencode
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
