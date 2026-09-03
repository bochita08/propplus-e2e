/**
 * Corre los tests E2E localmente haciendo TODO el setup solo:
 *   1. emulador Android (arranca uno si no hay ninguno)
 *   2. Metro / expo start en el repo de la app (si no está corriendo)
 *   3. adb reverse tcp:8081
 *   4. los tests (wdio), pasándole el device real por ANDROID_DEVICE
 *
 * Uso:
 *   npm run local
 *   npm run local -- --spec appium/tests/login.e2e.ts
 *   npm run local -- --mochaOpts.grep "credenciales"
 *   npm run local:stop        (baja emulador + Metro)
 *
 * Requiere: Android Studio instalado (con un AVD creado) y Node 18+.
 * El repo de la app se busca en PROPPLUS_APP_DIR, ../claudio, .., ../../claudio.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const isWin = process.platform === 'win32';
const c = {
  step: (m) => console.log(`\x1b[36m▸\x1b[0m ${m}`),
  ok: (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`),
  warn: (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`),
};
const die = (m) => {
  console.error(`\x1b[31m✗ ${m}\x1b[0m`);
  process.exit(1);
};

// ---------- rutas del SDK ----------
const ANDROID_HOME =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  join(homedir(), 'AppData', 'Local', 'Android', 'Sdk');
const ADB = join(ANDROID_HOME, 'platform-tools', isWin ? 'adb.exe' : 'adb');
const EMU_DIR = join(ANDROID_HOME, 'emulator');
const EMULATOR = join(EMU_DIR, isWin ? 'emulator.exe' : 'emulator');
const npx = isWin ? 'npx.cmd' : 'npx';

const adb = (args, opts = {}) =>
  spawnSync(ADB, args, { encoding: 'utf8', ...opts });

// ---------- modo stop ----------
if (process.argv[2] === 'stop') {
  c.step('Bajando emulador y Metro...');
  adb(['emu', 'kill']);
  // matar lo que escuche en 8081
  if (isWin) {
    spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      "Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }",
    ]);
  } else {
    spawnSync('bash', ['-c', "lsof -ti tcp:8081 | xargs -r kill"]);
  }
  c.ok('Listo.');
  process.exit(0);
}

// ---------- 1. SDK ----------
if (!existsSync(ADB)) {
  die(
    `No encontré adb en:\n  ${ADB}\n` +
      `Instalá Android Studio, o seteá ANDROID_HOME a la carpeta del SDK.`,
  );
}

// ---------- 2. emulador ----------
function devicesOnline() {
  const out = adb(['devices']).stdout || '';
  return out
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => /\tdevice$/.test(l))
    .map((l) => l.split('\t')[0]);
}

let device = devicesOnline()[0];

if (!device) {
  const avds = (spawnSync(EMULATOR, ['-list-avds'], { encoding: 'utf8' }).stdout || '')
    .trim()
    .split('\n')
    .filter(Boolean);
  if (!avds.length) {
    die(
      'No hay ningún emulador creado.\n' +
        'Android Studio → More Actions → Virtual Device Manager → Create device.',
    );
  }
  const avd = avds[0];
  c.step(`Arrancando emulador "${avd}" (esto tarda ~1 min)...`);
  const p = spawn(EMULATOR, ['-avd', avd, '-netdelay', 'none', '-netspeed', 'full'], {
    cwd: EMU_DIR,
    detached: true,
    stdio: 'ignore',
  });
  p.unref();

  process.stdout.write('  esperando boot');
  for (let i = 0; i < 100; i++) {
    await sleep(2000);
    process.stdout.write('.');
    const boot = (adb(['shell', 'getprop', 'sys.boot_completed']).stdout || '').trim();
    if (boot === '1') {
      device = devicesOnline()[0];
      break;
    }
  }
  console.log();
  if (!device) die('El emulador no terminó de bootear.');
}
c.ok(`Emulador: ${device}`);

// ¿está Expo Go?
const pkgs = adb(['-s', device, 'shell', 'pm', 'list', 'packages']).stdout || '';
if (!pkgs.includes('host.exp.exponent')) {
  c.warn(
    'Expo Go no está instalado en el emulador.\n' +
      '    Instalálo: en el repo de la app corré  npm run android  (una vez),\n' +
      '    o abrí la Play Store del emulador y buscá "Expo Go".',
  );
}

// ---------- 3. Metro ----------
async function metroUp() {
  try {
    const r = await fetch('http://127.0.0.1:8081/status');
    return r.status === 200;
  } catch {
    return false;
  }
}

function findAppDir() {
  const candidatos = [
    process.env.PROPPLUS_APP_DIR,
    resolve('..', 'claudio'),
    resolve('..'),
    resolve('..', '..', 'claudio'),
  ].filter(Boolean);
  for (const dir of candidatos) {
    const appJson = join(dir, 'app.json');
    if (existsSync(appJson)) {
      try {
        const j = JSON.parse(readFileSync(appJson, 'utf8'));
        if (j?.expo?.slug === 'prop-plus') return dir;
      } catch {
        /* seguir */
      }
    }
  }
  return null;
}

if (await metroUp()) {
  c.ok('Metro ya corría en :8081');
} else {
  const appDir = findAppDir();
  if (!appDir) {
    die(
      'No encontré el repo de la app (PROP+).\n' +
        'Seteá PROPPLUS_APP_DIR, o arrancá Metro a mano:  cd ../claudio && npx expo start',
    );
  }
  c.step(`Arrancando Metro en ${appDir} ...`);
  const m = spawn(npx, ['expo', 'start'], {
    cwd: appDir,
    detached: true,
    stdio: 'ignore',
    shell: isWin,
  });
  m.unref();

  process.stdout.write('  esperando Metro');
  let up = false;
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    process.stdout.write('.');
    if (await metroUp()) {
      up = true;
      break;
    }
  }
  console.log();
  if (!up) die('Metro no levantó (revisá que ../claudio tenga node_modules).');
  c.ok('Metro arriba (queda corriendo; para bajarlo:  npm run local:stop)');
}

// ---------- 4. adb reverse ----------
adb(['-s', device, 'reverse', 'tcp:8081', 'tcp:8081']);
c.ok('adb reverse 8081');

// ---------- 5. tests ----------
const extra = process.argv.slice(2);
c.step(`Corriendo tests${extra.length ? ' ' + extra.join(' ') : ''}...\n`);

const res = spawnSync(npx, ['wdio', 'run', 'wdio.conf.ts', ...extra], {
  stdio: 'inherit',
  shell: isWin,
  env: { ...process.env, ANDROID_DEVICE: device }, // pisa el .env con el device real
});

if (res.status !== 0) {
  console.log(
    `\n\x1b[33mReporte:\x1b[0m  npm run report      \x1b[90m(logs en ./logs)\x1b[0m`,
  );
}
process.exit(res.status ?? 0);
