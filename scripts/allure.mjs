/**
 * Wrapper de allure-commandline que autoconfigura JAVA_HOME antes de correr,
 * igual que shared/env.ts hace para los tests. Así `npm run report` funciona
 * sin importar cómo esté el PATH del sistema.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

if (!process.env.JAVA_HOME || !existsSync(process.env.JAVA_HOME)) {
  const candidatos = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Android\\Android Studio1\\jbr',
    join(homedir(), 'AppData', 'Local', 'Programs', 'Android Studio', 'jbr'),
  ];
  const java = candidatos.find((p) => existsSync(p));
  if (java) process.env.JAVA_HOME = java;
}

if (!process.env.JAVA_HOME) {
  console.error('[allure] No encontré un JDK. Instalá Android Studio o seteá JAVA_HOME.');
  process.exit(1);
}

const require = createRequire(import.meta.url);
const allure = require('allure-commandline');

const proc = allure(process.argv.slice(2));
proc.on('exit', (code) => process.exit(code ?? 0));
