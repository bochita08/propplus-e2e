# Crear un test nuevo — paso a paso

Guía manual para agregar un test E2E con Appium. Un test toca **dos repos**:

1. **`../claudio`** (la app PROP+) → le ponés `testID` a los elementos que vas a tocar.
2. **`propplus-e2e`** (este repo) → creás el archivo `.e2e.ts` con el test.

Como ejemplo real vamos a hacer: **"marcar una propiedad como favorita desde el
detalle y verificar que el botón cambia a *Quitar de favoritos*"**.

---

# PARTE A — Modificar la app PROP+ (`../claudio`)

Los tests buscan elementos por `testID`. En Android, `testID` se convierte en
`resource-id`, que es lo que Appium puede localizar. Si el elemento no tiene
`testID`, se lo agregás.

Para este ejemplo necesitamos tocar 3 elementos:

| Elemento | Dónde está | testID a poner |
|---|---|---|
| La primera carta de propiedad (para abrir el detalle) | `src/components/PropertyCard.tsx` | `property-card-<id>` |
| El botón "Agregar a favoritos" del detalle | `src/screens/PropertyDetailScreen.tsx` | `detail-favorite` |
| (ya está) el corazón chico usa `FavoriteButton` | `src/components/FavoriteButton.tsx` | — |

## Paso A1 — `FavoriteButton` acepta `testID`

Abrí `src/components/FavoriteButton.tsx`.

**a)** En la interfaz `Props`, agregá una línea:

```tsx
interface Props {
  propertyId: string;
  size?: number;
  variant?: 'floating' | 'plain';
  style?: ViewStyle;
  testID?: string;          // <-- nueva
}
```

**b)** Agregá `testID` a los parámetros de la función:

```tsx
export default function FavoriteButton({
  propertyId,
  size = 22,
  variant = 'floating',
  style,
  testID,                   // <-- nuevo
}: Props) {
```

**c)** Pasáselo al `<Pressable>`, con un default útil:

```tsx
<Pressable
  testID={testID ?? `favorite-${propertyId}`}   // <-- nueva línea
  onPress={() => toggleFavorite(propertyId)}
  ...
>
```

> Con esto, cada corazón de cada carta queda con `testID="favorite-prop-1"`, etc.

## Paso A2 — `testID` en la carta de propiedad

Abrí `src/components/PropertyCard.tsx`. El `<Pressable>` raíz (línea ~18):

```tsx
<Pressable
  testID={`property-card-${property.id}`}   // <-- nueva línea
  onPress={onPress}
  accessibilityRole="button"
  ...
>
```

## Paso A3 — `testID` en el botón "Agregar a favoritos" del detalle

Abrí `src/screens/PropertyDetailScreen.tsx`. Buscá el `<Pressable>` con
`style={[styles.favPill, ...]}` (línea ~83) y agregале:

```tsx
<Pressable
  testID="detail-favorite"                    // <-- nueva línea
  onPress={() => toggleFavorite(property.id)}
  style={[styles.favPill, isFavorite(property.id) && styles.favPillActive]}
  accessibilityRole="button"
>
```

## Paso A4 — Recargar la app

En la terminal donde corre `npx expo start`, apretá **`r`** (recarga).
O reiniciá el emulador con la app. Los `testID` nuevos ya están en el bundle.

## Paso A5 — Verificar que el `testID` llegó (opcional pero recomendado)

Dos formas:

**Rápida** — un test descartable que vuelca el árbol:

```ts
// appium/tests/_scratch.e2e.ts
import { loginDemo } from '../../shared/app';

describe('scratch', () => {
  it('dump', async () => {
    await loginDemo();
    console.log(await driver.getPageSource());
  });
});
```

```bash
npm run test:spec -- appium/tests/_scratch.e2e.ts
```

Buscá `resource-id="property-card-prop-1"` en la salida. Después borrás el archivo.

**Visual** — Appium Inspector (app de escritorio): conectás con las capabilities
de `wdio.conf.ts` y clickeás la UI para ver el `resource-id` de cada cosa.

---

# PARTE B — Crear el test en `propplus-e2e`

## Paso B1 — Registrar los selectores nuevos

Abrí `shared/selectors.ts` y agregá al objeto `S`:

```ts
export const S = {
  signIn: { /* ... lo que ya está ... */ },

  // nuevo:
  lista: {
    primeraCarta: 'property-card-prop-1',
  },
  detalle: {
    favorito: 'detail-favorite',
  },
} as const;
```

> Regla: **ningún string de `testID` hardcodeado en los tests**. Todo pasa por `S`.

## Paso B2 — Crear el archivo del test

Creá `appium/tests/favoritos.e2e.ts`. Tiene que terminar en `.e2e.ts` para que
`npm test` lo agarre solo.

```ts
import { S, byId } from '../../shared/selectors';
import { loginDemo } from '../../shared/app';
import { tocar, verTexto } from '../../shared/actions';
import { paso } from '../../shared/log';

describe('PROP+ · Favoritos', () => {
  // arranca logueado, en el listado de propiedades
  beforeEach(loginDemo);

  it('marca una propiedad como favorita desde el detalle', async () => {
    paso('Abro el detalle de la primera propiedad');
    await tocar('la primera carta', byId(S.lista.primeraCarta));

    // el botón arranca en "Agregar a favoritos"
    await verTexto('Agregar a favoritos');

    await tocar('el botón Agregar a favoritos', byId(S.detalle.favorito));

    // ahora tiene que decir "Quitar de favoritos"
    await verTexto('Quitar de favoritos');
  });

  it('lo puedo desmarcar y vuelve a "Agregar a favoritos"', async () => {
    await tocar('la primera carta', byId(S.lista.primeraCarta));
    await tocar('el botón de favorito', byId(S.detalle.favorito));
    await verTexto('Quitar de favoritos');

    paso('Lo desmarco');
    await tocar('el botón de favorito otra vez', byId(S.detalle.favorito));
    await verTexto('Agregar a favoritos');
  });
});
```

### Qué hace cada pieza

| Pieza | Para qué |
|---|---|
| `beforeEach(loginDemo)` | reinicia la app, hace login con la cuenta demo, deja el listado a la vista. Cada `it` arranca limpio. |
| `byId(S.x.y)` | traduce el `testID` a un selector `resource-id` de Android |
| `tocar('nombre legible', selector)` | click + lo narra en consola y en el reporte (`▸ Toco ...`) |
| `verTexto('...')` | espera a que ese texto esté visible y lo confirma (`✓ Visible: ...`) |
| `paso('...')` | un renglón de contexto tuyo en consola + reporte |

### Acciones disponibles (`shared/actions.ts`)

```ts
await tocar('el botón X', byId(S....));
await escribirEn('el campo Y', byId(S....), 'texto');   // click + clear + type
await verTexto('Texto exacto visible');
await pantallaVisible('Título de la pantalla');          // espera larga (90s)
```

Para textos parciales o elementos sin `testID`:

```ts
import { byText, byTextContains } from '../../shared/selectors';
await $(byTextContains('USD ')).click();
```

## Paso B3 — Correr solo este test

```bash
npm run test:spec -- appium/tests/favoritos.e2e.ts
```

Acordate de tener prendidos: emulador + `npx expo start` (en `../claudio`) +
`adb reverse tcp:8081 tcp:8081`.

Un solo `it` de ese archivo:

```bash
npx wdio run wdio.conf.ts --spec appium/tests/favoritos.e2e.ts --mochaOpts.grep "desmarcar"
```

## Paso B4 — Verlo en el reporte

```bash
npm run report
```

Se abre el HTML: vas a ver "PROP+ · Favoritos" con los 2 tests y, adentro de
cada uno, los pasos narrados. Si algo falla, hay screenshot automático.

## Paso B5 — Sumarlo a una suite (opcional)

En `wdio.conf.ts`, bloque `suites`:

```ts
suites: {
  smoke: ['./appium/tests/login.e2e.ts'],
  favoritos: ['./appium/tests/favoritos.e2e.ts'],
  todo: ['./appium/tests/**/*.e2e.ts'],
},
```

```bash
npm test -- --suite favoritos
```

---

# Receta corta (para cualquier test nuevo)

1. **En `../claudio`**: ¿el elemento que voy a tocar tiene `testID`? Si no, se lo
   pongo y recargo la app (`r` en Metro).
2. **En `propplus-e2e/shared/selectors.ts`**: agrego el `testID` a `S`.
3. **En `propplus-e2e/appium/tests/<algo>.e2e.ts`**:
   - `describe` + `beforeEach(loginDemo)` (o `irALogin` si el test es de auth)
   - `it(...)` con `tocar()` / `escribirEn()` / `verTexto()`
4. `npm run test:spec -- appium/tests/<algo>.e2e.ts`
5. `npm run report` para verlo lindo.

## Errores típicos al crear un test

| Síntoma | Causa |
|---|---|
| `element ("android=new UiSelector()...") still not displayed` | el `testID` no está en la app, o no recargaste (`r` en Metro), o está mal escrito en `S` |
| El texto de `verTexto()` no aparece | fijate el texto **exacto** (acentos incluidos) que muestra la app; o el elemento tarda → ya espera 15s solo |
| El teclado tapa un campo | `await ocultarTeclado()` antes de tocar lo que está abajo |
| Lo que escribís queda pegado con lo anterior | usá `escribirEn()` (hace clear), no `$(...).addValue()` a mano |
| Test pasa solo pero falla en la tanda | estado arrastrado → asegurate de usar `beforeEach` (no `before`) |
