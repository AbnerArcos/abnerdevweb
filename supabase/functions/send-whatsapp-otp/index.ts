// =====================================================================
// MESA · send-whatsapp-otp
// Esta función es el "Send SMS Hook" de Supabase Auth.
// Supabase genera el código de 6 dígitos, lo guarda y lo verifica él
// mismo; esta función SOLO se encarga de entregarlo por WhatsApp usando
// la API oficial de Meta (WhatsApp Cloud API).
//
// Desplegar:  supabase functions deploy send-whatsapp-otp --no-verify-jwt
// (el --no-verify-jwt es obligatorio: quien llama es Supabase Auth, no
//  un usuario con sesión; la seguridad viene de la firma del hook)
//
// Secretos necesarios (Supabase → Edge Functions → Secrets):
//   SEND_SMS_HOOK_SECRET      v1,whsec_xxxxx   (lo da Supabase al crear el hook)
//   WHATSAPP_TOKEN            token permanente de Meta
//   WHATSAPP_PHONE_NUMBER_ID  id del número emisor
//   WHATSAPP_TEMPLATE_NAME    ej. mesa_codigo
//   WHATSAPP_TEMPLATE_LANG    ej. es_MX
//   WHATSAPP_TEMPLATE_BUTTON  "true" si la plantilla trae botón "copiar código"
//   WHATSAPP_API_VERSION      opcional, por defecto v21.0
// =====================================================================

import { Webhook } from "npm:standardwebhooks@1.0.0";

const HOOK_SECRET   = Deno.env.get("SEND_SMS_HOOK_SECRET") ?? "";
const WA_TOKEN      = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WA_PHONE_ID   = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WA_TEMPLATE   = Deno.env.get("WHATSAPP_TEMPLATE_NAME") ?? "mesa_codigo";
const WA_LANG       = Deno.env.get("WHATSAPP_TEMPLATE_LANG") ?? "es_MX";
const WA_HAS_BUTTON = (Deno.env.get("WHATSAPP_TEMPLATE_BUTTON") ?? "true") === "true";
const WA_VERSION    = Deno.env.get("WHATSAPP_API_VERSION") ?? "v21.0";

function fail(message: string, code = 500) {
  return new Response(
    JSON.stringify({ error: { http_code: code, message } }),
    { status: code, headers: { "Content-Type": "application/json" } },
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return fail("Method not allowed", 405);

  if (!HOOK_SECRET || !WA_TOKEN || !WA_PHONE_ID) {
    return fail("Faltan secretos: SEND_SMS_HOOK_SECRET / WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID", 500);
  }

  const raw = await req.text();

  // 1) Verificar que quien llama es realmente Supabase Auth
  let payload: { user: { phone?: string }; sms: { otp: string } };
  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((v, k) => (headers[k] = v));
    const wh = new Webhook(HOOK_SECRET.replace("v1,whsec_", ""));
    payload = wh.verify(raw, headers) as typeof payload;
  } catch (_e) {
    return fail("Firma del hook inválida", 401);
  }

  const phone = (payload.user?.phone ?? "").replace(/\D/g, "");
  const otp = payload.sms?.otp ?? "";
  if (!phone || !otp) return fail("Petición sin teléfono o sin código", 400);

  // 2) Enviar el código por WhatsApp con una plantilla de autenticación
  const components: unknown[] = [
    { type: "body", parameters: [{ type: "text", text: otp }] },
  ];
  if (WA_HAS_BUTTON) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: otp }],
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/${WA_VERSION}/${WA_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phone,
        type: "template",
        template: {
          name: WA_TEMPLATE,
          language: { code: WA_LANG },
          components,
        },
      }),
    },
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("WhatsApp API error", res.status, detail);
    return fail(`WhatsApp rechazó el envío: ${detail.slice(0, 300)}`, 500);
  }

  // 3) Éxito: Supabase espera 200 con cuerpo vacío
  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
