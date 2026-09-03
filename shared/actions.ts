import { byText } from './selectors';
import { paso, ok, aviso } from './log';
import { APP_ID, reabrirApp } from './config';

const TIMEOUT = 15_000;

/**
 * A veces (Autofill del sistema, un reconnect de Metro, etc.) la app termina
 * en segundo plano en medio de un test. Si un `waitForDisplayed` falla,
 * chequeamos eso antes de rendirnos: si la app no está en primer plano, la
 * reabrimos y el que llamó puede reintentar una vez más antes de fallar de
 * verdad.
 */
async function reabrirSiNoEstaEnPrimerPlano(): Promise<boolean> {
  try {
    const estado = (await driver.execute('mobile: queryAppState', { appId: APP_ID })) as number;
    if (estado === 4) return false; // ya está en primer plano (ApplicationState.RUNNING_IN_FOREGROUND)
  } catch {
    /* si la consulta falla, probamos reabrir igual */
  }
  aviso('La app no está en primer plano, la reabro y reintento...');
  await reabrirApp();
  return true;
}

/** Toca un elemento, narrando la acción con un nombre legible. */
export async function tocar(nombre: string, selector: string): Promise<void> {
  paso(`Toco ${nombre}`);
  const el = $(selector);
  try {
    await el.waitForDisplayed({ timeout: TIMEOUT });
  } catch (e) {
    if (!(await reabrirSiNoEstaEnPrimerPlano())) throw e;
    await el.waitForDisplayed({ timeout: TIMEOUT });
  }
  await el.click();
}

/**
 * Escribe en un input de forma confiable (foco + limpiar + tipear).
 * Necesario por los TextInput controlados de React Native.
 */
export async function escribirEn(
  nombre: string,
  selector: string,
  valor: string,
): Promise<void> {
  paso(`Escribo "${valor}" en ${nombre}`);
  const el = $(selector);
  try {
    await el.waitForDisplayed({ timeout: TIMEOUT });
  } catch (e) {
    if (!(await reabrirSiNoEstaEnPrimerPlano())) throw e;
    await el.waitForDisplayed({ timeout: TIMEOUT });
  }
  await el.click();
  await el.clearValue();
  await el.addValue(valor);
  await driver.pause(150);
}

/**
 * Verifica que un texto exacto aparezca en pantalla.
 * Valida que RN lo renderizó (existe en el árbol) — no exige que ya esté dentro
 * del viewport, porque banners y errores pueden quedar scrolleados fuera en
 * pantallas chicas (típico en el emulador de CI). Igual intenta traerlo a la
 * vista para que el screenshot de fallo sea útil.
 */
export async function verTexto(texto: string): Promise<void> {
  paso(`Verifico que se ve: "${texto}"`);
  const el = $(byText(texto));
  await el.waitForExist({ timeout: TIMEOUT });
  await el.scrollIntoView().catch(() => {
    /* algunas pantallas no scrollean: no pasa nada */
  });
  ok(`Visible: "${texto}"`);
}

/** Espera a que aparezca una pantalla, identificada por un texto/título visible. */
export async function pantallaVisible(
  titulo: string,
  timeout = 90_000,
): Promise<void> {
  paso(`Espero la pantalla "${titulo}"`);
  await $(byText(titulo)).waitForExist({ timeout });
  ok(`Pantalla "${titulo}" cargada`);
}
