// =====================================================================
// MESA · create-portal-session
// Abre el portal de Stripe para que el usuario cambie su tarjeta,
// vea sus facturas o cancele la membresía.
//
// Desplegar: supabase functions deploy create-portal-session
// Secretos: STRIPE_SECRET_KEY, APP_URL
// =====================================================================

import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const APP_URL = Deno.env.get("APP_URL") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Sin sesión" }, 401);

  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData?.user) return json({ error: "Sesión inválida" }, 401);

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!sub?.stripe_customer_id) {
    return json({ error: "Todavía no tienes una membresía activa" }, 400);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${APP_URL}/?portal=back`,
    locale: "es",
  });

  return json({ url: session.url });
});
