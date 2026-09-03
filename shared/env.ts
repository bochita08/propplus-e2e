/**
 * Autoconfigura JAVA_HOME / ANDROID_HOME para el proceso de tests, sin depender
 * de cómo esté el PATH del sistema. Se importa PRIMERO en wdio.conf.ts.
 *
 * Solo toca `process.env` de esta corrida: no modifica nada del sistema.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const home = homedir();
const esWindows = process.platform === 'win32';

function primeroQueExiste(candidatos: string[]): string | undefined {
  return candidatos.filter(Boolean).find((p) => existsSync(p));
}

// ---- JAVA_HOME ----
// En CI (GitHub Actions) ya viene seteado por setup-java: si existe, no lo tocamos.
if (esWindows && (!process.env.JAVA_HOME || !existsSync(process.env.JAVA_HOME))) {
  const java = primeroQueExiste([
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Android\\Android Studio1\\jbr',
    join(home, 'AppData', 'Local', 'Programs', 'Android Studio', 'jbr'),
    'C:\\Program Files\\Eclipse Adoptium',
  ]);
  if (java) process.env.JAVA_HOME = java;
}

// ---- ANDROID_HOME / ANDROID_SDK_ROOT ----
if (!process.env.ANDROID_HOME || !existsSync(process.env.ANDROID_HOME)) {
  const sdk = primeroQueExiste([
    process.env.ANDROID_SDK_ROOT ?? '',
    join(home, 'AppData', 'Local', 'Android', 'Sdk'),
  ]);
  if (sdk) {
    process.env.ANDROID_HOME = sdk;
    process.env.ANDROID_SDK_ROOT = sdk;
  }
}

// ---- PATH del proceso (java + adb) ----
// Separador correcto según SO (';' en Windows, ':' en Linux/CI).
const extra = [
  process.env.JAVA_HOME && join(process.env.JAVA_HOME, 'bin'),
  process.env.ANDROID_HOME && join(process.env.ANDROID_HOME, 'platform-tools'),
].filter((p): p is string => Boolean(p) && existsSync(p as string));

if (extra.length) {
  process.env.PATH = [...extra, process.env.PATH ?? ''].join(delimiter);
}

if (!process.env.JAVA_HOME) {
  console.warn(
    '\x1b[33m[env]\x1b[0m No se encontró un JDK. Instalá Android Studio o seteá JAVA_HOME a mano.',
  );
}
