import { S, byId, byText, demoUser } from './selectors';
import { paso, ok, info } from './log';
import { escribirEn, pantallaVisible, tocar } from './actions';

const DEEP_LINK = {
  url: process.env.EXPO_DEV_URL as string,
  package: process.env.APPIUM_APP_PACKAGE as string,
};

/**
 * Reinicia Expo Go y vuelve a abrir PROP+ desde cero (JS fresco).
 * Aísla cada test: la pantalla de login se reusa entre navegaciones y arrastra
 * estado del formulario si no se recarga el bundle.
 */
export async function abrirApp(): Promise<void> {
  paso('Abro PROP+ (reinicio Expo Go)');
  await driver.execute('mobile: terminateApp', { appId: DEEP_LINK.package });
  await driver.pause(600);
  await driver.execute('mobile: deepLink', DEEP_LINK);
  await driver.pause(3500);
  info('PROP+ abierto en Expo Go');
}

/** Oculta el teclado si está abierto. */
export async function ocultarTeclado(): Promise<void> {
  try {
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

  const enLogin = await $(byText('Iniciar sesión'))
    .isDisplayed()
    .catch(() => false);
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
