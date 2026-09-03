import { S, byId, byText, demoUser } from './selectors';
import { paso, ok, info } from './log';
import { escribirEn, pantallaVisible, tocar } from './actions';
import { MODO_APK, reabrirApp } from './config';

/**
 * Reinicia PROP+ desde cero para aislar cada test (el form de login arrastra
 * estado si no se recarga).
 *  - APK: terminate + activate com.propplus.app (abre en el login).
 *  - Expo Go: terminate Expo Go + deep link al proyecto.
 */
// Alguna de estas pantallas significa "la app terminó de cargar" (pasó el splash).
const APP_LISTA =
  '//*[@text="Iniciar sesión" or @text="Propiedades" or @text="Ingresá tus datos para continuar"]';

export async function abrirApp(): Promise<void> {
  paso(MODO_APK ? 'Abro PROP+ (reinicio la app)' : 'Abro PROP+ (reinicio Expo Go)');
  await reabrirApp();
  // Esperar a que pase el splash: el APK release en el emulador de CI tarda,
  // y en Expo Go el deep link puede tardar si Metro recién reconectó.
  await $(APP_LISTA).waitForExist({ timeout: MODO_APK ? 60_000 : 90_000 });
  await driver.pause(500);
  info(MODO_APK ? 'PROP+ abierto' : 'PROP+ abierto en Expo Go');
}

/**
 * Oculta el teclado si está abierto.
 * Chequea `isKeyboardShown()` antes de mandar el comando: si no hay teclado,
 * no hace nada (evita que Appium caiga a un back-press "a ciegas", que en
 * emuladores con Autofill activo puede terminar sacando la app al home).
 */
export async function ocultarTeclado(): Promise<void> {
  try {
    const visible = await driver.isKeyboardShown();
    if (!visible) return;
    await driver.execute('mobile: hideKeyboard');
    info('Teclado oculto');
  } catch {
    /* no estaba abierto */
  }
}

/**
 * Deja la app en la pantalla de "Iniciar sesión".
 * Si hay sesión activa, cierra sesión por la UI.
 */
export async function irALogin(): Promise<void> {
  await abrirApp();

  const enLogin = await $(byText('Iniciar sesión')).isExisting();
  if (enLogin) {
    ok('Ya estoy en la pantalla de login');
    return;
  }

  info('Hay una sesión activa, cierro sesión');
  await tocar('la pestaña Perfil', byText('Perfil'));
  await tocar('el botón Cerrar sesión', byId('profile-signout'));
  await tocar('Cerrar sesión en el diálogo de confirmación', 'id=android:id/button1');
  await pantallaVisible('Iniciar sesión');
}

/** Login con la cuenta demo. Deja la app en el listado de propiedades. */
export async function loginDemo(): Promise<void> {
  await irALogin();
  paso('Inicio sesión con la cuenta demo');
  await escribirEn('el campo Email', byId(S.signIn.email), demoUser.email);
  await escribirEn('el campo Contraseña', byId(S.signIn.password), demoUser.password);
  await ocultarTeclado();
  await tocar('el botón Ingresar', byId(S.signIn.submit));
  await pantallaVisible('5 propiedades', 20_000);
  ok('Sesión iniciada, estoy en el listado de propiedades');
}
