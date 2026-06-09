const { test, expect } = require('@playwright/test');

test.describe('Harness de Pruebas - El Ahorcado', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() =>
      typeof window.palabraSecreta === 'string' && window.palabraSecreta.length > 0
    );
  });

  test('Debería completar una partida perfecta (Victoria 🏆)', async ({ page }) => {
    // Leer la palabra secreta desde la variable global expuesta
    const palabraSecreta = await page.evaluate(() => window.palabraSecreta);

    // Tipear cada letra de la palabra
    for (const letra of palabraSecreta) {
      if (letra === 'ñ') {
        await page.evaluate(() => elegirLetra('ñ'));
      } else {
        await page.keyboard.press(letra);
      }
      await page.waitForTimeout(100);
    }

    // Esperar a que aparezca el overlay
    await page.waitForSelector('#resultadoOverlay.visible', { timeout: 3000 });

    // Verificar overlay visible con icono de partida perfecta
    const overlay = page.locator('#resultadoOverlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('🏆');

    // Verificar puntaje (letras únicas * 10 + bonus)
    const letrasUnicas = [...new Set(palabraSecreta.split(''))];
    const puntajeEsperado = (letrasUnicas.length * 10) + 50;
    const badgePuntaje = page.locator('.puntaje-valor');
    await expect(badgePuntaje).toHaveText(puntajeEsperado.toString());
  });

  test('Debería manejar correctamente la derrota (7 errores)', async ({ page }) => {
    // Leer la palabra para elegir letras que NO estén en ella
    const palabra = await page.evaluate(() => window.palabraSecreta);
    const letrasIncorrectas = [];
    for (let i = 97; i <= 122 && letrasIncorrectas.length < 7; i++) {
      const letra = String.fromCharCode(i);
      if (!palabra.includes(letra)) letrasIncorrectas.push(letra);
    }
    const extras = ['ñ', 'w', 'k', 'x'];
    for (const letra of extras) {
      if (letrasIncorrectas.length >= 7) break;
      if (!palabra.includes(letra)) letrasIncorrectas.push(letra);
    }

    for (const letra of letrasIncorrectas) {
      await page.keyboard.press(letra);
      await page.waitForTimeout(50);
    }

    // Esperar overlay
    await page.waitForSelector('#resultadoOverlay.visible', { timeout: 3000 });

    // Verificar que las 7 vidas están en estado perdida
    const vidasPerdidas = page.locator('.vida.perdida');
    await expect(vidasPerdidas).toHaveCount(7);

    // Verificar overlay de derrota
    const overlay = page.locator('#resultadoOverlay');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('💀');

    // El puntaje no debe ser negativo (empieza en 0 y no baja de 0)
    const badgePuntaje = page.locator('.puntaje-valor');
    await expect(badgePuntaje).toHaveText('0');
  });

  test('Diseño responsive en celulares (480px)', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 800 });

    const contenedor = page.locator('.contenedor');
    await expect(contenedor).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/responsive-480px.png' });
  });
});
