/**
 * Cómo abrir PROP+: en CI corremos contra el APK, local dentro de Expo Go.
 * Centralizado acá porque tanto `app.ts` (abrir/reabrir la app) como
 * `actions.ts` (recuperación automática si la app se va a segundo plano)
 * lo necesitan, y así evitamos import circular entre esos dos.
 */
import { byText } from './selectors';

export const MODO_APK = !!process.env.APPIUM_APP;
export const APP_ID = MODO_APK ? 'com.propplus.app' : (process.env.APPIUM_APP_PACKAGE as string);
export const DEEP_LINK = {
  url: process.env.EXPO_DEV_URL as string,
  package: process.env.APPIUM_APP_PACKAGE as string,
};

/**
 * Expo Go muestra, una sola vez por instalación, un tutorial nativo
 * ("This is the developer menu...") la primera vez que conecta a un
 * proyecto. Como el setup automático instala Expo Go de cero, ese tutorial
 * puede aparecer y tapar la app. Si está, lo cerramos tocando "Continue".
 * Espera corta (no depende del bundle de JS, es UI nativa de Expo Go) para
 * no penalizar las corridas normales donde nunca aparece.
 */
async function cerrarTutorialDevMenu(): Promise<void> {
  if (MODO_APK) return; // el tutorial es cosa de Expo Go, no existe en modo APK
  try {
    const boton = $(byText('Continue'));
    const aparecio = await boton
      .waitForExist({ timeout: 1200 })
      .then(() => true)
      .catch(() => false);
    if (aparecio) {
      await boton.click();
      await driver.pause(300);
    }
  } catch {
    /* no estaba */
  }
}

/**
 * Reabre PROP+ desde cero (sin narración en consola/Allure; pensado tanto
 * para el reinicio normal entre tests como para la recuperación automática
 * cuando la app aparece en segundo plano en medio de un test).
 *  - APK: terminate + activate com.propplus.app.
 *  - Expo Go: terminate Expo Go + deep link al proyecto.
 */
export async function reabrirApp(): Promise<void> {
  if (MODO_APK) {
    await driver.execute('mobile: terminateApp', { appId: APP_ID });
    await driver.pause(400);
    await driver.execute('mobile: activateApp', { appId: APP_ID });
  } else {
    await driver.execute('mobile: terminateApp', { appId: DEEP_LINK.package });
    await driver.pause(600);
    await driver.execute('mobile: deepLink', DEEP_LINK);
  }
  await driver.pause(500);
  await cerrarTutorialDevMenu();
}
