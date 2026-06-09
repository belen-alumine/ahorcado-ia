# Especificaciones del Ahorcado

## Descripción general
Juego del ahorcado clásico en el navegador. El usuario debe adivinar una palabra letra por letra antes de que se complete el dibujo del ahorcado.

## Tecnología
- HTML5, CSS3, JavaScript (vanilla)
- Sin dependencias externas
- Servidor HTTP incluido con Node.js (módulos nativos: `http`, `fs`, `path`)

## Cómo ejecutar
1. `node server.js`
2. Abrir `http://localhost:3000` en el navegador

## Tests
Los tests usan Playwright y están en `tests/ahorcado.spec.js`.

### Requisitos
```
npm install
npx playwright install chromium
```

### Ejecutar tests
```
npx playwright test ahorcado
```

## Lista de palabras
hola, termonuclear, baston, cartuchera, programación, aburrido, quince, balanza, cuaderno, puerta, gatos

## Reglas del juego
- Se elige una palabra al azar de la lista
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

## Interfaz
- Canvas para dibujar el ahorcado progresivamente
- Badge de puntaje mostrando puntos acumulados
- Palabra con letras o guiones en fondo gris, con animación pop al actualizar
- 7 indicadores de vidas que cambian de verde a rojo al fallar
- Feedback visual con fondo de color (verde = ganaste, rojo = perdiste)
- Lista de letras incorrectas
- Entrada por teclado (a–z, ñ)
- Botones de letras a–z + ñ, con feedback verde/rojo
- Botón "Nueva palabra"
- Animaciones: shake en palabra al errar, pop al acertar
- Responsive hasta 480px
- Fondo con gradiente oscuro
- Contenedor blanco semitransparente con backdrop-filter
