# Mesa · Guía de conexión paso a paso

Todo el código está listo. Lo que falta es conectar tus cuentas y pegar tus llaves.
Sigue los pasos **en orden**. Cada paso dice exactamente dónde dar clic y qué pegar.

Tiempo aproximado: 1 hora para Supabase y Stripe, más la espera de Meta para aprobar
la plantilla de WhatsApp (suele tardar de minutos a 24 horas).

---

## 0. Qué hay en la carpeta

```
mesa/
├── index.html                      La app (mismo diseño de siempre)
├── .env.example                    Plantilla de llaves secretas
├── INSTRUCCIONES.md                Este archivo
│
├── assets/js/
│   ├── config.js                   ← EL ÚNICO ARCHIVO QUE EDITAS TÚ
│   ├── supabase-client.js          Conexión con Supabase
│   ├── store.js                    Guarda y lee todo en Supabase
│   ├── auth.js                     Acceso con código por WhatsApp
│   └── billing.js                  Prueba gratis, bloqueo y Stripe
│
└── supabase/
    ├── 01_schema.sql               Tablas, relaciones y alta automática
    ├── 02_policies.sql             Políticas RLS (cada quien ve lo suyo)
    ├── 03_storage.sql              Buckets de imágenes y sus políticas
    └── functions/
        ├── _shared/cors.ts
        ├── send-whatsapp-otp/      Entrega el código por WhatsApp
        ├── create-checkout-session/ Cobro de la membresía
        ├── create-portal-session/  Cambiar tarjeta o cancelar
        ├── stripe-webhook/         Activa/desactiva la membresía
        └── delete-account/         Borrado total de la cuenta
```

---

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> → **New project**.
2. Ponle nombre (ej. `mesa`), elige región **East US** o **West US** (las más cercanas a México), y guarda la contraseña de la base de datos en un lugar seguro.
3. Espera a que termine de crearse (2–3 minutos).

## 2. Crear las tablas

1. En el menú izquierdo: **SQL Editor** → **New query**.
2. Abre el archivo `supabase/01_schema.sql`, copia **todo** su contenido, pégalo y presiona **Run**.
3. Repite lo mismo, en este orden, con:
   - `supabase/02_policies.sql`
   - `supabase/03_storage.sql`
4. Ve a **Table Editor**: debes ver las tablas `profiles`, `businesses`, `categories`, `products`, `payment_methods`, `service_types`, `sales`, `sale_items`, `settings` y `subscriptions`.
5. Ve a **Storage**: debes ver los buckets `product-images`, `avatars` y `business-logos`.

> Si alguna consulta marca error, léelo: casi siempre es porque se pegó a medias. Vuelve a copiar el archivo completo.

## 3. Conectar la app con tu proyecto

1. En Supabase: **Project Settings → API**.
2. Copia **Project URL** y **anon public**.
3. Abre `assets/js/config.js` y reemplaza:

```js
SUPABASE_URL:      'https://TU-PROYECTO.supabase.co',
SUPABASE_ANON_KEY: 'PEGA_AQUI_TU_ANON_KEY',
```

> La `anon key` es pública a propósito: se puede ver en el navegador. Quien protege tus datos son las políticas RLS del paso 2. La que **nunca** se pega aquí es la `service_role`.

Si abres `index.html` ahora, la app debe cargar y mostrarte la pantalla de bienvenida. Todavía no podrás entrar: falta WhatsApp.

---

## 4. Acceso por WhatsApp

Hay dos caminos. **Elige uno.**

### Opción A · Twilio Verify (más rápido, sin programar)

Es la vía corta: Twilio ya tiene el trámite de WhatsApp resuelto y Supabase la soporta de fábrica.

1. Crea cuenta en <https://twilio.com> y activa **Verify** (Verify → Services → Create).
2. En el servicio de Verify, activa el canal **WhatsApp** y termina el registro del remitente que te pide Twilio.
3. Anota: `Account SID`, `Auth Token` y `Verify Service SID`.
4. En Supabase: **Authentication → Sign In / Providers → Phone**:
   - Enciende **Enable Phone provider**.
   - SMS provider: **Twilio Verify**.
   - Pega los tres datos.
   - En **Message channel** elige **WhatsApp** (si tu versión del panel no lo muestra, configúralo dentro del servicio de Verify en Twilio).
5. Guarda. **No necesitas desplegar la función `send-whatsapp-otp`.**

### Opción B · WhatsApp Cloud API de Meta (más barato a la larga, más trámite)

1. Entra a <https://developers.facebook.com> → crea una app tipo **Business** → agrega el producto **WhatsApp**.
2. En **API Setup** anota el **Phone number ID** y genera un **token permanente** (System User con permisos `whatsapp_business_messaging`).
3. Crea la plantilla en **WhatsApp Manager → Plantillas de mensajes**:
   - Nombre: `mesa_codigo`
   - Categoría: **Autenticación**
   - Idioma: **Español (MX)**
   - Tipo de código: **Copiar código**
   - Envíala a revisión y espera la aprobación.
4. En Supabase: **Authentication → Hooks → Send SMS hook**:
   - Enciende el hook, tipo **HTTPS**.
   - URL: `https://TU-PROYECTO.supabase.co/functions/v1/send-whatsapp-otp`
   - Copia el **secret** que aparece (empieza con `v1,whsec_`).
5. En Supabase: **Authentication → Providers → Phone** → enciende **Enable Phone provider**.
6. Instala el CLI y despliega la función (ver paso 6 de esta guía) con estos secretos:

```
SEND_SMS_HOOK_SECRET      el secret del hook
WHATSAPP_TOKEN            el token permanente de Meta
WHATSAPP_PHONE_NUMBER_ID  el Phone number ID
WHATSAPP_TEMPLATE_NAME    mesa_codigo
WHATSAPP_TEMPLATE_LANG    es_MX
WHATSAPP_TEMPLATE_BUTTON  true
```

> Si tu plan de Supabase no deja activar el hook **Send SMS**, usa la Opción A. Es la misma experiencia para tu usuario.

### Ajustes comunes a las dos opciones

En **Authentication → Providers → Phone**:
- **Enable phone confirmations**: encendido.
- **OTP length**: 6.
- **OTP expiry**: 600 segundos (10 minutos) está bien.

---

## 5. Stripe (membresía de $129 MXN al mes)

1. Crea tu cuenta en <https://stripe.com> y complete el registro del negocio.
2. **Products → Add product**:
   - Nombre: `Membresía Mesa`
   - Precio: **129.00 MXN**, **Recurring**, **Monthly**
   - Guarda y copia el **Price ID** (empieza con `price_`).
3. **Developers → API keys** → copia la **Secret key** (`sk_test_...` para probar, `sk_live_...` cuando ya vayas en serio).
4. El **webhook** se crea en el paso 7, cuando la función ya exista.

---

## 6. Desplegar las Edge Functions

Necesitas el CLI de Supabase una sola vez.

**Instalar (elige según tu sistema):**
```bash
# macOS
brew install supabase/tap/supabase

# Windows (con Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Entrar y enlazar tu proyecto** (el `project-ref` es la parte que va antes de `.supabase.co` en tu URL):
```bash
supabase login
cd mesa
supabase link --project-ref TU-PROJECT-REF
```

**Cargar los secretos:** copia `.env.example` a `.env`, llénalo y ejecuta:
```bash
supabase secrets set --env-file ./.env
```

**Desplegar:**
```bash
# Solo si elegiste la Opción B de WhatsApp
supabase functions deploy send-whatsapp-otp --no-verify-jwt

# Siempre
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy delete-account
supabase functions deploy stripe-webhook --no-verify-jwt
```

> El `--no-verify-jwt` en esas dos es obligatorio: quien las llama es Supabase Auth y Stripe, que no tienen sesión de usuario. Su seguridad es la **firma** del mensaje, que ambas funciones verifican.

---

## 7. Conectar el webhook de Stripe

1. En Stripe: **Developers → Webhooks → Add endpoint**.
2. URL: `https://TU-PROYECTO.supabase.co/functions/v1/stripe-webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copia el **Signing secret** (`whsec_...`), agrégalo a tu `.env` como `STRIPE_WEBHOOK_SECRET` y vuelve a ejecutar:

```bash
supabase secrets set --env-file ./.env
supabase functions deploy stripe-webhook --no-verify-jwt
```

---

## 8. Publicar la app

La app son archivos estáticos: sirve cualquier hosting gratuito.

**Con Netlify (lo más sencillo):**
1. Entra a <https://app.netlify.com/drop>.
2. Arrastra la carpeta `mesa` completa (sin la carpeta `supabase`, que no se publica).
3. Copia la URL que te da.

**O con Vercel / Cloudflare Pages:** sube la carpeta como sitio estático.

Después:
1. Pon esa URL en `.env` como `APP_URL` (sin diagonal al final) y vuelve a correr `supabase secrets set --env-file ./.env`.
2. Vuelve a desplegar `create-checkout-session` y `create-portal-session`.
3. En Supabase: **Authentication → URL Configuration → Site URL** → pon la misma URL.

> Importante: no publiques la carpeta `supabase/` ni el archivo `.env` en el hosting. Solo `index.html` y `assets/`.

---

## 9. Probar que todo funciona

Marca cada punto:

- [ ] Abro la app y veo la pantalla de bienvenida (sin el aviso rojo de "Falta conectar Supabase").
- [ ] Escribo mi número, toco **Continuar con WhatsApp** y me llega el código.
- [ ] Meto el código y entro. Me pide mi nombre.
- [ ] Aparece el aviso de **2 meses gratis** y abajo del encabezado la franja verde con los días.
- [ ] Creo una categoría y un producto **con foto**. En Supabase → Storage → `product-images` aparece el archivo dentro de una carpeta con mi id de usuario.
- [ ] Hago una venta. En Table Editor → `sales` y `sale_items` aparecen las filas.
- [ ] Recargo la app: todo sigue ahí (ya no depende del teléfono).
- [ ] Cierro sesión, entro desde otro dispositivo con el mismo número y veo **los mismos datos**.
- [ ] En **Mi cuenta → Mi plan** veo los días de prueba restantes.

**Probar el bloqueo y el cobro (sin esperar dos meses):**

1. En SQL Editor corre esto para vencer tu prueba:
   ```sql
   update public.subscriptions
      set trial_end = now() - interval '1 day'
    where user_id = auth.uid();
   ```
   (si lo corres desde el editor, cambia `auth.uid()` por tu id de usuario, que ves en **Authentication → Users**)
2. Recarga la app: debe aparecer la pantalla **"Tu prueba gratis terminó"** y no debe dejarte cobrar.
3. Toca **Activar membresía**, paga con la tarjeta de prueba `4242 4242 4242 4242`, cualquier fecha futura y cualquier CVC.
4. Al volver, la app se desbloquea sola en unos segundos.
5. Para regresar tu prueba a la normalidad:
   ```sql
   update public.subscriptions
      set trial_end = now() + interval '60 days', status = 'trialing'
    where user_id = 'TU-ID-DE-USUARIO';
   ```

---

## 10. Si algo falla

| Qué ves | Qué revisar |
|---|---|
| Aviso "Falta conectar Supabase" | `assets/js/config.js` sigue con los valores de ejemplo |
| El código no llega por WhatsApp | Supabase → **Logs → Auth** y **Edge Functions → send-whatsapp-otp**. Casi siempre es la plantilla de Meta aún sin aprobar o el token vencido |
| A México no llega, a otros países sí | Prueba enviando con `+521` (WhatsApp usaba ese "1" en México). Cambia `Auth.e164` en `assets/js/auth.js` si tu proveedor lo exige |
| "Pediste muchos códigos seguidos" | Es el límite de Supabase: espera 60 segundos |
| Entro pero no veo mis datos | Falta correr `02_policies.sql`, o el usuario se creó antes de correr `01_schema.sql` (borra ese usuario en Authentication → Users y vuelve a entrar) |
| Las fotos no se ven | Falta `03_storage.sql`, o los buckets no existen |
| Pagué y no se desbloquea | Stripe → Webhooks → mira si el evento salió en rojo. Revisa `STRIPE_WEBHOOK_SECRET` |
| "No pudimos abrir el pago" | Falta `STRIPE_PRICE_ID` o `APP_URL` en los secretos |

**Dónde ver los errores:** Supabase → **Edge Functions → (la función) → Logs**, y en el navegador con `DEBUG: true` en `config.js` y la consola abierta (F12).

---

## 11. Datos que puedes cambiar después

| Qué | Dónde |
|---|---|
| Duración de la prueba | `01_schema.sql` (`interval '60 days'`, en dos lugares) y `TRIAL_DAYS` en `config.js` |
| Precio de la membresía | En Stripe (nuevo precio) y el texto en `MEMBERSHIP_LABEL` de `config.js` |
| IVA | `IVA_RATE` en `index.html` y la columna `iva_rate` de `settings` |
| Países disponibles | Arreglo `COUNTRIES` en `index.html` |
| Fotos públicas en vez de firmadas | Ver el comentario al final de `03_storage.sql` y `PUBLIC_BUCKETS` en `config.js` |

---

## 12. Cosas que conviene saber

- **La app funciona sin internet a medias**: si se cae la señal mientras cobras, la venta se guarda en una cola y se sube sola al volver la conexión. Verás el aviso "Sin conexión · se guardará solo".
- **localStorage ya no guarda tus datos.** Solo queda ahí la sesión (la maneja la librería de Supabase) y esa cola temporal de cambios pendientes.
- **Nadie puede alargarse la prueba desde el navegador.** Además del bloqueo visual, las políticas RLS impiden escribir ventas o productos sin membresía vigente.
- **Cada usuario está aislado.** Todas las consultas pasan por `auth.uid()`; no existe forma de leer los datos de otro negocio, ni sus fotos.
- **Costos aproximados:** Supabase gratis alcanza para empezar (después ~25 USD/mes); Stripe cobra 3.6% + $3 MXN por cargo; WhatsApp cobra por conversación de autenticación (unos centavos por código enviado).
