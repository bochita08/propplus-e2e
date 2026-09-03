import allure from '@wdio/allure-reporter';

const C = {
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
};

function allureStep(texto: string): void {
  try {
    allure.addStep(texto);
  } catch {
    /* fuera del contexto de un test */
  }
}

/** Paso principal de un test. Sale en consola y en el reporte Allure. */
export function paso(mensaje: string): void {
  console.log(`${C.cyan('▸')} ${mensaje}`);
  allureStep(mensaje);
}

/** Confirmación de que algo se cumplió. */
export function ok(mensaje: string): void {
  console.log(`  ${C.green('✓')} ${mensaje}`);
  allureStep(`✓ ${mensaje}`);
}

/** Detalle informativo (no crítico). */
export function info(mensaje: string): void {
  console.log(`  ${C.gray('·')} ${mensaje}`);
}

/** Aviso. */
export function aviso(mensaje: string): void {
  console.log(`  ${C.yellow('!')} ${mensaje}`);
  allureStep(`! ${mensaje}`);
}
