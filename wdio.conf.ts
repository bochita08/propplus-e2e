import './shared/env'; // configura JAVA_HOME / ANDROID_HOME (debe ir primero)
import 'dotenv/config';
import { resolve } from 'node:path';
import type { Frameworks } from '@wdio/types';

/**
 * Dos modos:
 *  - APK (CI): si está `APPIUM_APP`, instala ese .apk y abre com.propplus.app directo.
 *  - Expo Go (local): sin `APPIUM_APP`, abre PROP+ dentro de Expo Go via deep link.
 */
const APK = process.env.APPIUM_APP;

const capabilitiesApk = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:app': APK ? resolve(APK) : undefined,
  'appium:appPackage': 'com.propplus.app',
  'appium:appActivity': '.MainActivity',
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 240,
  'appium:fullReset': false,
} as const;

const capabilitiesExpoGo = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:udid': process.env.ANDROID_DEVICE,
  'appium:appPackage': process.env.APPIUM_APP_PACKAGE, // host.exp.exponent (Expo Go)
  'appium:appActivity': '.experience.HomeActivity',
  'appium:appWaitActivity': '*',
  // No reseteamos Expo Go (mantiene login / permisos entre corridas).
  'appium:noReset': true,
  'appium:autoGrantPermissions': true,
  'appium:newCommandTimeout': 240,
} as const;

export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  specs: ['./appium/tests/**/*.e2e.ts'],
  // Grupos para correr con:  npm test -- --suite smoke
  suites: {
    smoke: ['./appium/tests/login.e2e.ts'],
    auth: ['./appium/tests/login.e2e.ts'],
  },
  maxInstances: 1,

  capabilities: [APK ? capabilitiesApk : capabilitiesExpoGo],

  // WDIO levanta y baja el server de Appium solo.
  services: [
    [
      'appium',
      {
        args: { address: '127.0.0.1', port: 4723, relaxedSecurity: true },
      },
    ],
  ],

  framework: 'mocha',
  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: 'allure-results',
        // Que Allure NO llene el reporte con cada comando de webdriver:
        // solo se ven los pasos que narramos con paso()/ok().
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],
  mochaOpts: {
    ui: 'bdd',
    timeout: 120_000,
  },

  // Consola limpia: nada de "INFO webdriver: COMMAND ...".
  // El detalle completo igual queda en ./logs/*.log por si hace falta.
  logLevel: 'error',
  outputDir: './logs',

  waitforTimeout: 20_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 3,

  // ---- Narración de inicio/fin de cada test ----
  beforeTest(test: Frameworks.Test) {
    console.log(`\n\x1b[1m\x1b[44m  TEST  \x1b[0m \x1b[1m${test.title}\x1b[0m`);
  },

  async afterTest(
    test: Frameworks.Test,
    _context: unknown,
    result: Frameworks.TestResult,
  ) {
    if (result.passed) {
      console.log(`\x1b[42m\x1b[30m  OK  \x1b[0m ${test.title}\n`);
    } else {
      console.log(`\x1b[41m  FALLÓ  \x1b[0m ${test.title}`);
      // El screenshot queda adjunto en el reporte Allure.
      try {
        await browser.takeScreenshot();
      } catch {
        /* sin sesión */
      }
    }
  },
};
