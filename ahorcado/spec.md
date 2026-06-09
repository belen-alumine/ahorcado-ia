# Especificaciones del Ahorcado

## Descripción general
Juego del ahorcado clásico en el navegador. El usuario debe adivinar una palabra letra por letra antes de que se complete el dibujo del ahorcado.

## Tecnología
- HTML5, CSS3, JavaScript (vanilla) — sin dependencias en el frontend
- Servidor HTTP con Node.js (módulos nativos: `http`, `fs`, `path`)
- Servidor MCP con `@modelcontextprotocol/sdk` para integración con herramientas de IA
- Las palabras vienen de APIs externas con fallback a generación por sílabas
- El servidor expone `/api/random-word` que devuelve `{ palabra, definicion }`

## Cómo ejecutar
1. `node wordsServer.mjs`
2. Abrir `http://localhost:3000` en el navegador

## Tests
Los tests usan **Playwright** y están en `tests/ahorcado.spec.js`.

### Requisitos
```
npm install
npx playwright install chromium
```

### Ejecutar tests
```bash
# Todos los tests (los 3 escenarios)
npx playwright test ahorcado

# Solo un navegador
npx playwright test ahorcado --project=chromium

# Modo interactivo (con UI)
npx playwright test ahorcado --ui

# Ver reporte HTML
npx playwright show-report
```

### Escenarios de test
1. **Victoria perfecta** — tipea todas las letras de la palabra sin errores → overlay 🏆 + confeti + estrellas
2. **Derrota** — tipea 7 letras incorrectas → overlay 💀 + vidas en rojo
3. **Responsive** — viewport 480px → contenedor visible + screenshot

## Reglas del juego
- Se obtiene una palabra aleatoria desde el servidor (`/api/random-word`), que consulta APIs externas con fallback a generación por sílabas
- El usuario ve guiones bajos (`_`) que representan cada letra
- El usuario elige letras haciendo clic en los botones o tipeando con el teclado (a–z, ñ)
- Si la letra está en la palabra, se muestra en su posición y suma puntos
- Si la letra no está, se dibuja una parte del ahorcado y resta puntos
- El juego termina al adivinar toda la palabra (victoria) o al completar el ahorcado (derrota)
- Cada partida tiene 7 errores permitidos

## Dibujo del ahorcado (7 etapas)
1. Cabeza
2. Torso
3. Brazo izquierdo
4. Brazo derecho
5. Pierna izquierda
6. Pierna derecha
7. Ahorque (soga, en rojo)

## Sistema de puntaje
- +10 puntos por cada letra acertada
- -5 puntos por cada letra errada (no baja de 0)
- +50 puntos de bonus al ganar la partida
- El puntaje se acumula entre rondas

## Resultado y celebraciones
- Al ganar o perder se muestra un overlay a pantalla completa con el resultado
- **Victoria normal**: emoji 🎉, confeti de colores con animación de partículas
- **Partida perfecta** (0 errores): emoji 🏆, confeti + estrellas doradas con brillo
- **Derrota**: emoji 💀, mensaje de ánimo
- Botón "Volver a jugar" en el overlay
- El overlay se cierra y se detienen las partículas al iniciar una nueva partida

## Interfaz
- **Encabezado**: ícono, título "Ahorcado", subtítulo explicativo
- **Canvas**: dibuja el ahorcado progresivamente
- **Puntaje**: badge con gradiente mostrando puntos acumulados
- **Palabra**: letras o guiones en fondo gris, con animación pop al actualizar
- **Vidas**: 7 indicadores circulares que cambian de verde a rojo al fallar
- **Mensaje**: feedback visual con fondo de color (verde = ganaste, rojo = perdiste)
- **Letras erradas**: lista de letras incorrectas en itálica
- **Entrada por teclado**: se puede jugar tipeando las letras directamente (a–z, ñ)
- **Botones de letras**: a–z + ñ, con borde redondeado, hover con elevación
  - Verdes: letras acertadas
  - Rojas: letras erradas
- **Botón "Nueva palabra"**: gradiente, bordes redondeados, hover con elevación
- **Animaciones**: shake en la palabra al errar, pop en la palabra al acertar
- **Responsive**: se adapta a pantallas de hasta 480px
- **Fondo**: gradiente oscuro de tres tonos
- **Contenedor**: fondo blanco semitransparente con backdrop-filter y sombra
