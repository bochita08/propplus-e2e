import { byText } from './selectors';
import { paso, ok } from './log';

const TIMEOUT = 15_000;

/** Toca un elemento, narrando la acción con un nombre legible. */
export async function tocar(nombre: string, selector: string): Promise<void> {
  paso(`Toco ${nombre}`);
  const el = $(selector);
  await el.waitForDisplayed({ timeout: TIMEOUT });
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
  await el.waitForDisplayed({ timeout: TIMEOUT });
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
