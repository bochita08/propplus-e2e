# propplus-e2e

Tests E2E **mobile** (Appium + WebdriverIO + Mocha) para la app **PROP+**
(`../claudio`).

## Requisitos

- Node 18+
- **Android Studio** instalado en la ruta por defecto
  (`C:\Program Files\Android\Android Studio`) + un emulador creado (ej. `Pixel_9`)

> `JAVA_HOME` y `ANDROID_HOME` **no hace falta configurarlos**: el repo los
> autodetecta en `shared/env.ts` (Java lo toma del que trae Android Studio, el
> SDK de `%LOCALAPPDATA%\Android\Sdk`). Si Android Studio está en otra ruta,
> seteá `JAVA_HOME` a mano y listo — nunca toques `PATH` con `setx`.

## Instalación

```bash
npm install
npm run appium:doctor   # tiene que dar todo OK
```

El driver de Android (`appium-uiautomator2-driver`) ya está en `package.json`;
`npm install` lo trae y Appium 3 lo autodetecta. **No** corras
`appium driver install uiautomator2` (falla con "already installed").

Copiá `.env.example` a `.env` y ajustá `ANDROID_DEVICE` con lo que devuelva `adb devices`.

## Cómo correr

Necesitás 3 cosas prendidas antes de los tests:

**1. Emulador** — desde Android Studio (Device Manager ▶) o:
```bash
"%ANDROID_HOME%\emulator\emulator" -avd Pixel_9
```

**2. Metro de PROP+**:
```bash
cd ..\claudio
npx expo start
```

**3. Puente de puerto** (una vez por sesión):
```bash
adb reverse tcp:8081 tcp:8081
```

**Después, los tests:**
```bash
npm test
```

La consola sale narrada paso a paso (`▸ Toco el botón Ingresar`, `✓ Visible: "..."`).

## Ver el reporte (Allure)

Después de correr `npm test` (que deja los resultados en `allure-results/`):

```bash
npm run report
```

Ese comando **genera el HTML y lo abre solo en el navegador**. Levanta un server
local en un puerto libre e imprime la dirección, algo así:

```
Server started at <http://127.0.0.1:XXXXX>. Press <Ctrl+C> to exit
```

Se abre solo; si no, copiás esa URL al navegador. `Ctrl+C` en esa terminal lo baja.

### Puerto fijo (opcional)

Si querés que sea siempre la misma dirección:

```bash
npm run report:generate
npx allure open allure-report --port 8080
```

→ queda en **http://localhost:8080**

### Comandos de reporte

| Comando | Qué hace |
|---|---|
| `npm run report` | genera + abre |
| `npm run report:generate` | solo genera `allure-report/` |
| `npm run report:open` | solo sirve lo ya generado |
| `npm run report:clean` | borra `allure-results/`, `allure-report/` y `logs/` |

En el reporte ves: % de éxito, cada test con sus pasos narrados, duración, y
**screenshot automático si un test falla**. Necesita Java (el de Android Studio
sirve, ya lo tenés en `JAVA_HOME`).

## Estructura

```
wdio.conf.ts            config de WebdriverIO + Appium + Allure
tsconfig.json
.env                    variables locales (no se commitea)
shared/selectors.ts     testIDs de la app + datos demo
shared/app.ts           flujos: abrirApp, irALogin, loginDemo
shared/actions.ts       acciones narradas: tocar, escribirEn, verTexto
shared/log.ts           paso() / ok() / info() -> consola + reporte
appium/tests/*.e2e.ts   specs
appium/apps/            APK de PROP+ (para el "camino B", gitignored)
allure-results/         datos crudos que genera cada corrida (gitignored)
allure-report/          HTML del reporte (gitignored)
logs/                   log completo de webdriver por corrida (gitignored)
```

> - Cómo correr tests puntuales, por archivo, por nombre, suites, helpers → **`README-tests.md`**
> - Cómo **crear un test nuevo** paso a paso (qué tocar en PROP+ y cómo armar el `.e2e.ts`) → **`CREAR-UN-TEST.md`**

## Camino B — usar un APK en vez de Expo Go

Más estable, sirve para CI. Buildeás PROP+:

```bash
cd ..\claudio
npx expo run:android --variant release
```

Copiás `android/app/build/outputs/apk/release/app-release.apk` a
`appium/apps/propplus.apk` y en `wdio.conf.ts` cambiás las capabilities:

```ts
'appium:app': require('node:path').resolve('appium/apps/propplus.apk'),
'appium:appPackage': 'com.propplus.app',
'appium:appActivity': '.MainActivity',
```

Y en los tests sacás la llamada a `abrirApp()` / `mobile: deepLink`
(la app abre directo en el login).
