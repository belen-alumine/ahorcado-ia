const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const palabraEl = document.getElementById('palabra');
const mensajeEl = document.getElementById('mensaje');
const letrasErradasEl = document.getElementById('letras-usadas');
const puntajeValorEl = document.querySelector('.puntaje-valor');
const vidasEl = document.querySelectorAll('.vida');
const botonesEl = document.getElementById('botones');
const reiniciarBtn = document.getElementById('reiniciar');
const overlay = document.getElementById('resultadoOverlay');
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiCtx = confettiCanvas.getContext('2d');
const volverJugarBtn = document.getElementById('volverJugar');
const resultadoIcono = document.getElementById('resultadoIcono');
const resultadoTitulo = document.getElementById('resultadoTitulo');
const resultadoPalabra = document.getElementById('resultadoPalabra');
const resultadoPuntaje = document.getElementById('resultadoPuntaje');
const resultadoMensaje = document.getElementById('resultadoMensaje');

const PALABRAS_LOCAL = [
  'java', 'computadora','teclado', 'objetos',
  'bug', 'consola', 'booleano', 'software',
  'solid', 'persistencia', 'codigo', 'lenguaje',
  'test', 'programacion', 'arquitectura', 'diseño',
  'python', 'javascript', 'react', 'web', 'desarrollo',
  'pipeline', 'infraestructura', 'api', 'frontend',
  'backend', 'fullstack', 'integracion', 'agile'
];

let puntaje = 0;
let palabraSecreta = '';
let letrasAdivinadas = [];
let letrasErradas = [];
let errores = 0;
const maxErrores = 7;

let animacionId = null;
let particulas = [];

function redimensionarConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}
window.addEventListener('resize', redimensionarConfetti);

function crearParticula(esEstrella) {
  const colores = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bca', '#ff9f43', '#a29bfe', '#fd79a8'];
  return {
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * 100,
    w: esEstrella ? 12 : 6 + Math.random() * 6,
    h: esEstrella ? 12 : 4 + Math.random() * 4,
    color: esEstrella ? '#ffd700' : colores[Math.floor(Math.random() * colores.length)],
    velocidadX: (Math.random() - 0.5) * 3,
    velocidadY: 1.5 + Math.random() * 3,
    rotacion: Math.random() * 360,
    rotacionVel: (Math.random() - 0.5) * 8,
    opacidad: 1,
    desvanecer: 0.002 + Math.random() * 0.003,
    esEstrella,
  };
}

function dibujarEstrella(x, y, size, rotacion) {
  confettiCtx.save();
  confettiCtx.translate(x, y);
  confettiCtx.rotate((rotacion * Math.PI) / 180);
  const s = size / 2;
  confettiCtx.beginPath();
  for (let i = 0; i < 5; i++) {
    const ang = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const metodo = i === 0 ? 'moveTo' : 'lineTo';
    confettiCtx[metodo](Math.cos(ang) * s, Math.sin(ang) * s);
  }
  confettiCtx.closePath();
  confettiCtx.fill();
  confettiCtx.restore();
}

function animarConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  particulas = particulas.filter(p => p.opacidad > 0 && p.y < confettiCanvas.height + 50);

  for (const p of particulas) {
    p.x += p.velocidadX;
    p.velocidadY += 0.05;
    p.y += p.velocidadY;
    p.rotacion += p.rotacionVel;
    p.opacidad -= p.desvanecer;

    confettiCtx.save();
    confettiCtx.globalAlpha = Math.max(0, p.opacidad);
    confettiCtx.fillStyle = p.color;
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate((p.rotacion * Math.PI) / 180);

    if (p.esEstrella) {
      confettiCtx.shadowColor = '#ffd700';
      confettiCtx.shadowBlur = 15;
      dibujarEstrella(0, 0, p.w, 0);
    } else {
      confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }
    confettiCtx.restore();
  }

  if (particulas.length > 0) {
    animacionId = requestAnimationFrame(animarConfetti);
  }
}

function lanzarConfetti(conEstrellas) {
  redimensionarConfetti();
  particulas = [];
  const total = conEstrellas ? 250 : 150;
  const estrellas = conEstrellas ? 40 : 0;
  for (let i = 0; i < total; i++) {
    particulas.push(crearParticula(false));
  }
  for (let i = 0; i < estrellas; i++) {
    particulas.push(crearParticula(true));
  }
  if (animacionId) cancelAnimationFrame(animacionId);
  animarConfetti();
}

function dibujarAhorcado(errores) {
  ctx.clearRect(0, 0, 200, 250);
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#333';

  ctx.beginPath();
  ctx.moveTo(20, 230);
  ctx.lineTo(180, 230);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(50, 230);
  ctx.lineTo(50, 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(50, 20);
  ctx.lineTo(130, 20);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(130, 20);
  ctx.lineTo(130, 50);
  ctx.stroke();

  if (errores >= 1) {
    ctx.beginPath();
    ctx.arc(130, 70, 20, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (errores >= 2) {
    ctx.beginPath();
    ctx.moveTo(130, 90);
    ctx.lineTo(130, 150);
    ctx.stroke();
  }
  if (errores >= 3) {
    ctx.beginPath();
    ctx.moveTo(130, 110);
    ctx.lineTo(100, 130);
    ctx.stroke();
  }
  if (errores >= 4) {
    ctx.beginPath();
    ctx.moveTo(130, 110);
    ctx.lineTo(160, 130);
    ctx.stroke();
  }
  if (errores >= 5) {
    ctx.beginPath();
    ctx.moveTo(130, 150);
    ctx.lineTo(100, 190);
    ctx.stroke();
  }
  if (errores >= 6) {
    ctx.beginPath();
    ctx.moveTo(130, 150);
    ctx.lineTo(160, 190);
    ctx.stroke();
  }
  if (errores >= 7) {
    ctx.beginPath();
    ctx.moveTo(130, 50);
    ctx.lineTo(130, 90);
    ctx.stroke();
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(110, 60);
    ctx.lineTo(130, 50);
    ctx.lineTo(150, 60);
    ctx.stroke();
  }
}

function actualizarVidas() {
  vidasEl.forEach((vida, i) => {
    vida.className = 'vida';
    if (i < errores) {
      vida.classList.add('perdida');
    } else {
      vida.classList.add('activa');
    }
  });
}

function actualizarPalabra() {
  let mostrar = '';
  for (const letra of palabraSecreta) {
    if (letrasAdivinadas.includes(letra)) {
      mostrar += letra;
    } else {
      mostrar += '_';
    }
  }
  palabraEl.textContent = mostrar;
  palabraEl.classList.remove('pop');
  requestAnimationFrame(() => palabraEl.classList.add('pop'));
}

function actualizarPuntaje() {
  puntajeValorEl.textContent = puntaje;
}

function mostrarResultado(ganaste, perfecto) {
  if (ganaste) {
    resultadoIcono.textContent = perfecto ? '🏆' : '🎉';
    resultadoTitulo.textContent = perfecto ? '¡Partida perfecta!' : '¡Ganaste!';
    resultadoMensaje.textContent = perfecto ? 'Sin cometer un solo error. Impresionante.' : 'Seguí así.';
    lanzarConfetti(perfecto);
  } else {
    resultadoIcono.textContent = '💀';
    resultadoTitulo.textContent = 'Perdiste';
    resultadoMensaje.textContent = 'Mejor suerte la próxima.';
  }
  resultadoPalabra.textContent = `La palabra era: ${palabraSecreta}`;
  resultadoPuntaje.textContent = `Puntaje total: ${puntaje}`;
  overlay.classList.add('visible');
}

function verificarFin() {
  if (errores >= maxErrores) {
    mensajeEl.textContent = `Perdiste! La palabra era: ${palabraSecreta}`;
    mensajeEl.className = 'mensaje perdiste';
    deshabilitarBotones();
    setTimeout(() => mostrarResultado(false, false), 600);
    return true;
  }
  const ganaste = palabraSecreta.split('').every(l => letrasAdivinadas.includes(l));
  if (ganaste) {
    puntaje += 50;
    actualizarPuntaje();
    mensajeEl.textContent = 'Ganaste! +50 puntos';
    mensajeEl.className = 'mensaje ganaste';
    deshabilitarBotones();
    setTimeout(() => mostrarResultado(true, errores === 0), 600);
    return true;
  }
  return false;
}

function elegirLetra(letra) {
  if (letrasAdivinadas.includes(letra) || letrasErradas.includes(letra)) return;
  const btn = document.querySelector(`button[data-letra="${letra}"]`);

  if (palabraSecreta.includes(letra)) {
    letrasAdivinadas.push(letra);
    puntaje += 10;
    actualizarPuntaje();
    btn.classList.add('acertada');
    btn.classList.add('pop');
  } else {
    letrasErradas.push(letra);
    errores++;
    actualizarVidas();
    if (puntaje >= 5) puntaje -= 5;
    actualizarPuntaje();
    btn.classList.add('fallada');
    dibujarAhorcado(errores);
    palabraEl.classList.add('shake');
    setTimeout(() => palabraEl.classList.remove('shake'), 500);
  }

  actualizarPalabra();
  letrasErradasEl.textContent = letrasErradas.length ? `Letras erradas: ${letrasErradas.join(', ')}` : '';
  btn.disabled = true;
  verificarFin();
}

function deshabilitarBotones() {
  document.querySelectorAll('.botones button').forEach(b => b.disabled = true);
}

function crearBotones() {
  botonesEl.innerHTML = '';
  for (let i = 97; i <= 122; i++) {
    const letra = String.fromCharCode(i);
    const btn = document.createElement('button');
    btn.textContent = letra;
    btn.dataset.letra = letra;
    btn.addEventListener('click', () => elegirLetra(letra));
    botonesEl.appendChild(btn);
  }
  const btn = document.createElement('button');
  btn.textContent = 'ñ';
  btn.dataset.letra = 'ñ';
  btn.addEventListener('click', () => elegirLetra('ñ'));
  botonesEl.appendChild(btn);
}

async function obtenerPalabra() {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('/api/random-word');
      if (res.ok) {
        const data = await res.json();
        if (data.palabra && data.palabra.length >= 3) return data.palabra;
      }
    } catch {}
  }
  return PALABRAS_LOCAL[Math.floor(Math.random() * PALABRAS_LOCAL.length)];
}

async function reiniciar() {
  overlay.classList.remove('visible');
  if (animacionId) {
    cancelAnimationFrame(animacionId);
    animacionId = null;
  }
  particulas = [];
  try {
    palabraSecreta = await obtenerPalabra();
  } catch {
    alert('Error al conectar con el servidor de palabras');
    return;
  }
  window.palabraSecreta = palabraSecreta;
  letrasAdivinadas = [];
  letrasErradas = [];
  errores = 0;
  mensajeEl.textContent = '';
  mensajeEl.className = 'mensaje';
  letrasErradasEl.textContent = '';
  palabraEl.classList.remove('shake');
  dibujarAhorcado(0);
  actualizarVidas();
  crearBotones();
  actualizarPalabra();
}

document.addEventListener('keydown', (e) => {
  if (overlay.classList.contains('visible')) return;
  let tecla = e.key.toLowerCase();
  if (tecla === 'ñ' || (tecla >= 'a' && tecla <= 'z')) {
    const btn = document.querySelector(`button[data-letra="${tecla}"]`);
    if (btn && !btn.disabled) {
      elegirLetra(tecla);
    }
  }
});

reiniciarBtn.addEventListener('click', () => reiniciar());
volverJugarBtn.addEventListener('click', () => reiniciar());
reiniciar();
