/**
 * Corre los tests E2E localmente haciendo TODO el setup solo, de cero si hace falta:
 *   0. clona el repo de la app (PROP+) si la carpeta no existe, e instala
 *      node_modules (de este repo y del de la app) si faltan, y crea el .env
 *      si no existe (a partir de .env.example)
 *   1. emulador Android (arranca uno si no hay ninguno)
 *   2. Metro / expo start en el repo de la app (si no está corriendo),
 *      instalando Expo Go en el emulador solo si hace falta
 *   3. adb reverse tcp:8081
 *   4. los tests (wdio), pasándole el device real por ANDROID_DEVICE
 *
 * Uso:
 *   npm run local
 *   npm run local -- --spec appium/tests/login.e2e.ts
 *   npm run local -- --mochaOpts.grep "credenciales"
 *   npm run local:stop        (baja emulador + Metro)
 *
 * Requiere: Android Studio instalado (con un AVD creado), Node 18+ y git.
 * El repo de la app se busca en PROPPLUS_APP_DIR, ../claudio, .., ../../claudio;
 * si no aparece en ninguna, se clona en PROPPLUS_APP_DIR (o ../claudio si esa
 * variable no está seteada) desde PROPPLUS_APP_REPO (por defecto el repo de
 * bochita08/claudio).
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, copyFileSync } from 'node:fs';
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

const npx = isWin ? 'npx.cmd' : 'npx';
const npm = isWin ? 'npm.cmd' : 'npm';

// ---------- rutas del SDK ----------
const ANDROID_HOME =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  join(homedir(), 'AppData', 'Local', 'Android', 'Sdk');
const ADB = join(ANDROID_HOME, 'platform-tools', isWin ? 'adb.exe' : 'adb');
const EMU_DIR = join(ANDROID_HOME, 'emulator');
const EMULATOR = join(EMU_DIR, isWin ? 'emulator.exe' : 'emulator');

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

// ---------- 0. SDK ----------
if (!existsSync(ADB)) {
  die(
    `No encontré adb en:\n  ${ADB}\n` +
      `Instalá Android Studio, o seteá ANDROID_HOME a la carpeta del SDK.`,
  );
}

// ---------- 1. bootstrap: repo de la app + node_modules + .env ----------
function ensureEnvFile() {
  if (!existsSync('.env') && existsSync('.env.example')) {
    copyFileSync('.env.example', '.env');
    c.ok('Creé .env a partir de .env.example');
  }
}

function ensureNodeModules(dir, label) {
  if (existsSync(join(dir, 'node_modules'))) return;
  c.step(`Instalando dependencias de ${label} (npm install en ${dir})...`);
  const r = spawnSync(npm, ['install'], { cwd: dir, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) die(`"npm install" falló en ${dir}.`);
  c.ok(`Dependencias de ${label} instaladas.`);
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

function ensureAppDir() {
  const encontrado = findAppDir();
  if (encontrado) return encontrado;

  const target = process.env.PROPPLUS_APP_DIR || resolve('..', 'claudio');
  if (existsSync(target)) {
    die(
      `${target} existe pero no parece el repo de PROP+ (falta app.json con slug "prop-plus").\n` +
        `Si el repo está en otro lado, seteá PROPPLUS_APP_DIR.`,
    );
  }
  const repo = process.env.PROPPLUS_APP_REPO || 'https://github.com/bochita08/claudio.git';
  c.step(`No encontré el repo de la app, clonando ${repo} en ${target} ...`);
  const g = spawnSync('git', ['clone', repo, target], { stdio: 'inherit', shell: isWin });
  if (g.status !== 0) {
    die('No pude clonar el repo de la app (revisá que tengas git instalado y conexión a internet).');
  }
  c.ok('Repo de la app clonado.');
  return target;
}

ensureEnvFile();
ensureNodeModules(resolve('.'), 'propplus-e2e (este repo)');
const appDir = ensureAppDir();
ensureNodeModules(appDir, 'claudio (la app)');

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

// El Autofill / "Guardar contraseña" de Android suele robarle el foco a la
// app justo después de tipear en un campo de contraseña (aparece un overlay
// del sistema), y eso puede tirar la app al home mientras el test todavía
// está tocando la pantalla. Lo desactivamos en el emulador para que los
// tests de login sean confiables.
adb(['-s', device, 'shell', 'settings', 'put', 'secure', 'autofill_service', 'null']);
c.ok('Autofill de Android desactivado en el emulador.');

// ---------- 3. Expo Go + Metro ----------
function expoGoInstalado() {
  const pkgs = adb(['-s', device, 'shell', 'pm', 'list', 'packages']).stdout || '';
  return pkgs.includes('host.exp.exponent');
}

const teniaExpoGo = expoGoInstalado();
if (!teniaExpoGo) {
  c.warn('Expo Go no está en el emulador — lo instalo solo al arrancar Metro (puede tardar un par de minutos la primera vez).');
}

async function metroUp() {
  try {
    const r = await fetch('http://127.0.0.1:8081/status');
    return r.status === 200;
  } catch {
    return false;
  }
}

if (await metroUp()) {
  c.ok('Metro ya corría en :8081');
  if (!teniaExpoGo) {
    c.warn(
      'Expo Go no está en el emulador y Metro ya estaba corriendo (no lo reinicio). ' +
        'Corré  npm run android  en ../claudio, o abrí la Play Store del emulador y ' +
        'buscá "Expo Go", y volvé a correr  npm run local.',
    );
  }
} else {
  c.step(`Arrancando Metro en ${appDir} ...`);
  // Si falta Expo Go, "expo start --android" lo instala solo (baja el APK
  // correcto para el SDK del proyecto) y abre la app; si ya está, alcanza
  // con levantar Metro nomás.
  const args = teniaExpoGo ? ['expo', 'start'] : ['expo', 'start', '--android'];
  const m = spawn(npx, args, {
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
  if (!up) {
    die('Metro no levantó (revisá que ../claudio tenga node_modules y que "npx expo start" corra sin errores a mano).');
  }
  c.ok('Metro arriba (queda corriendo; para bajarlo:  npm run local:stop)');

  if (!teniaExpoGo) {
    process.stdout.write('  esperando que se instale Expo Go en el emulador');
    let instalado = false;
    for (let i = 0; i < 45; i++) {
      await sleep(2000);
      process.stdout.write('.');
      if (expoGoInstalado()) {
        instalado = true;
        break;
      }
    }
    console.log();
    if (instalado) {
      c.ok('Expo Go instalado.');
    } else {
      c.warn(
        'Expo Go todavía no aparece instalado. Si los tests fallan por eso, abrí la Play ' +
          'Store del emulador y buscá "Expo Go", o corré  npm run android  en ../claudio.',
      );
    }
  }
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
