# Cómo correr los tests

Tests E2E **mobile** de PROP+ con **Appium + WebdriverIO + Mocha**, contra el
emulador Android.

---

## 1. Antes de correr nada (3 cosas prendidas)

### a) Emulador Android

Desde Android Studio → **Device Manager** → ▶, o por consola:

```bash
"%ANDROID_HOME%\emulator\emulator" -avd Pixel_9
```

Verificá que está:

```bash
adb devices
```

Tiene que aparecer `emulator-5554   device`. Si es otro id, cambialo en `.env`
(`ANDROID_DEVICE=...`).

### b) Metro de PROP+ (el bundler de la app)

```bash
cd ..\claudio
npx expo start
```

Dejalo corriendo en su terminal.

### c) Puente de puerto (una vez por sesión)

```bash
adb reverse tcp:8081 tcp:8081
```

> El server de Appium lo levanta y lo baja WebdriverIO solo (no hace falta
> `appium` a mano).

---

## 2. Correr TODO

```bash
npm test
```

Corre todos los archivos que matcheen `appium/tests/**/*.e2e.ts`.

---

## 3. Correr UN archivo

```bash
npm run test:spec -- appium/tests/login.e2e.ts
```

(el `--` es obligatorio: pasa el argumento al script)

También con un glob por nombre:

```bash
npm run test:spec -- "**/login*"
```

### Varios archivos a la vez

```bash
npx wdio run wdio.conf.ts --spec appium/tests/login.e2e.ts --spec appium/tests/favoritos.e2e.ts
```

### Todos los de una carpeta

```bash
npx wdio run wdio.conf.ts --spec "./appium/tests/auth/*.e2e.ts"
```

### Excluir un archivo

```bash
npx wdio run wdio.conf.ts --exclude appium/tests/mapa.e2e.ts
```

---

## 4. Correr UN test puntual (por nombre)

Filtra por texto del `it(...)` / `describe(...)` (regex de Mocha):

```bash
npm run test:grep -- "email"
```

En Windows, si el patrón tiene espacios, npm a veces lo parte. Para frases usá
la forma directa con comillas:

```bash
npx wdio run wdio.conf.ts --mochaOpts.grep "email sin @"
```

Combinable con un archivo:

```bash
npx wdio run wdio.conf.ts --spec appium/tests/login.e2e.ts --mochaOpts.grep "credenciales"
```

### Marcar tests para saltear / enfocar en el código

```ts
it.only('solo este corre', async () => { ... });
it.skip('este se saltea', async () => { ... });
describe.only('solo esta suite', () => { ... });
```

---

## 5. Suites (grupos definidos en `wdio.conf.ts`)

En `wdio.conf.ts`, bloque `suites`:

```ts
suites: {
  smoke: ['./appium/tests/login.e2e.ts'],
  auth:  ['./appium/tests/login.e2e.ts'],
}
```

Correr una suite:

```bash
npm run test:smoke
```

```bash
npm test -- --suite auth
```

A medida que agregues archivos, sumalos a la suite que corresponda.

---

## 6. Agregar un archivo de tests nuevo

> Guía completa paso a paso (incluye qué modificar en el repo de PROP+):
> **`CREAR-UN-TEST.md`**.

1. Creá `appium/tests/<lo-que-sea>.e2e.ts` (tiene que terminar en `.e2e.ts`).
2. Ya lo agarra `npm test` automáticamente (por el glob de `specs`).
3. Estructura típica:

```ts
import { S, byId } from '../../shared/selectors';
import { loginDemo } from '../../shared/app';
import { tocar, verTexto } from '../../shared/actions';
import { paso } from '../../shared/log';

describe('PROP+ · Favoritos', () => {
  beforeEach(loginDemo); // arranca logueado en el listado

  it('marca una propiedad como favorita', async () => {
    paso('Abro la primera propiedad');
    await tocar('la primera carta', byId('property-card-prop-1'));
    await tocar('el botón Agregar a favoritos', /* ... */ 'android=...');
    await verTexto('Quitar de favoritos');
  });
});
```

### Helpers de acción con narración (`shared/actions.ts`)

| Helper | Qué hace / cómo sale en consola y reporte |
|---|---|
| `tocar('el botón X', sel)` | `▸ Toco el botón X` |
| `escribirEn('el campo Y', sel, 'texto')` | `▸ Escribo "texto" en el campo Y` (click + clear + type) |
| `verTexto('...')` | `▸ Verifico que se ve: "..."` → `✓ Visible: "..."` |
| `pantallaVisible('Título')` | espera la pantalla → `✓ Pantalla "Título" cargada` |

### Narración manual (`shared/log.ts`)

```ts
import { paso, ok, info, aviso } from '../../shared/log';
paso('Abro el panel de estadísticas');   // ▸ (paso principal, va al reporte)
ok('El contador muestra 1');              //   ✓
info('detalle no crítico');               //   ·
```

### Flujo (`shared/app.ts`)

| Helper | Qué hace |
|---|---|
| `abrirApp()` | reinicia Expo Go y reabre PROP+ (JS fresco) |
| `irALogin()` | deja la app en "Iniciar sesión" (cierra sesión si hace falta) |
| `loginDemo()` | login con la cuenta demo, deja la app en el listado |
| `ocultarTeclado()` | baja el teclado |

### Selectores (`shared/selectors.ts`)

- `byId('signin-email')` → busca por `resource-id` (lo que genera `testID` en la app)
- `byText('5 propiedades')` → busca por texto visible exacto
- `byTextContains('propiedad')` → texto parcial
- `S.signIn.email` etc → nombres de los `testID`, centralizados

> Si agregás un `testID` nuevo en la app PROP+, sumalo a `S` en `selectors.ts`
> para no hardcodear strings en los tests.

---

## 7. Reportes y debug

### Consola

Sale narrado paso a paso (`▸ Toco el botón Ingresar`, `✓ Visible: "..."`) más
el resumen `spec` al final. El firehose de webdriver está apagado
(`logLevel: 'error'`); el detalle completo igual queda en `./logs/*.log`.

### Reporte visual (Allure)

```bash
npm test           # corre y genera los resultados en allure-results/
npm run report     # genera el HTML y lo abre en el navegador
```

O por separado:

```bash
npm run report:generate   # crea allure-report/
npm run report:open       # lo sirve
npm run report:clean      # borra resultados, reporte y logs
```

En el reporte ves: % de éxito, cada test con sus pasos narrados
(`Escribo "..." en el campo Email`, etc.), duración, y **screenshot automático
si un test falla**. Necesita Java (el de Android Studio sirve).

### Descubrir selectores

- Ver el árbol de elementos:
  instalá **Appium Inspector** (app de escritorio), conectá con estas capabilities:
  ```json
  {
    "platformName": "Android",
    "appium:automationName": "UiAutomator2",
    "appium:udid": "emulator-5554",
    "appium:appPackage": "host.exp.exponent",
    "appium:appActivity": ".experience.HomeActivity",
    "appium:noReset": true
  }
  ```
- Dump del árbol desde un test:
  ```ts
  console.log(await driver.getPageSource());
  ```
- Screenshot manual (además del automático al fallar):
  ```ts
  await driver.saveScreenshot('./logs/paso.png');
  ```

---

## 8. Problemas comunes

| Síntoma | Causa / solución |
|---|---|
| `element ... still not displayed` en un input | el teclado tapa el elemento → `await ocultarTeclado()` antes |
| El texto que escribís queda duplicado o mezclado | usá `escribir()` en vez de `.setValue()` (inputs controlados de RN) |
| `Iniciar sesión` no aparece tras `irALogin` | Metro caído, o `adb reverse` no corrió, o el emulador se durmió |
| `Could not find a driver for automationName 'UiAutomator2'` | `npx appium driver install uiautomator2` |
| Errores de Java / `JAVA_HOME` | `shared/env.ts` lo autodetecta del Android Studio. Si igual falla, Android Studio está en otra ruta → seteá `JAVA_HOME` a mano. **Nunca** `setx PATH "%PATH%;..."` (rompe el PATH). |
| `java` no aparece en el PATH pero los tests andan | es normal: los tests usan `JAVA_HOME`, no el PATH |
| Test #2 falla pero aislado pasa | estado arrastrado entre tests → `beforeEach(irALogin)` reinicia la app |

### Si ya rompiste el PATH con `setx PATH`

Limpiá solo el PATH **de usuario** (no toca el del sistema), en PowerShell:

```powershell
$u = [Environment]::GetEnvironmentVariable('PATH','User')
$limpio = ($u -split ';' | Where-Object { $_ -and $_ -ne '%JAVA_HOME%\bin' } | Select-Object -Unique) -join ';'
[Environment]::SetEnvironmentVariable('PATH', $limpio, 'User')
```

Después cerrá y reabrí la terminal. (`JAVA_HOME` como variable está bien, no la toques.)

---

## 9. Camino B — APK propio (sin Expo Go)

Para CI o correr sin Metro, ver `README.md` sección "Camino B": buildeás
`npx expo run:android --variant release`, copiás el `.apk` a `appium/apps/` y
cambiás las capabilities. Los tests quedan igual (sacás el `abrirApp()` que hace
el deep link, la app abre directo en el login).
