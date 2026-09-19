// =====================================================================
// MESA · create-checkout-session
// Crea la sesión de pago de Stripe para la membresía de $129 MXN al mes
// y devuelve la URL a la que se manda al usuario.
//
// Desplegar: supabase functions deploy create-checkout-session
//
// Secretos:
//   STRIPE_SECRET_KEY   sk_live_... (o sk_test_... mientras pruebas)
//   STRIPE_PRICE_ID     price_... (precio recurrente de 129 MXN/mes)
//   APP_URL             https://tudominio.com  (a dónde regresa Stripe)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY  (los pone Supabase solo)
// =====================================================================

import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_ID = Deno.env.get("STRIPE_PRICE_ID") ?? "";
const APP_URL = Deno.env.get("APP_URL") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!PRICE_ID) return json({ error: "Falta STRIPE_PRICE_ID" }, 500);

  // 1) ¿Quién está pidiendo pagar? Se valida el token de sesión
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Sin sesión" }, 401);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Sesión inválida" }, 401);
  const user = userData.user;

  // 2) Cliente de Stripe (se reutiliza si ya existía)
  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  let customerId = sub?.stripe_customer_id ?? null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      phone: user.phone ? `+${user.phone}` : undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin
      .from("subscriptions")
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }

  // 3) Sesión de pago
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    locale: "es",
    client_reference_id: user.id,
    subscription_data: { metadata: { supabase_user_id: user.id } },
    metadata: { supabase_user_id: user.id },
    success_url: `${APP_URL}/?checkout=success`,
    cancel_url: `${APP_URL}/?checkout=cancel`,
  });

  return json({ url: session.url });
});
