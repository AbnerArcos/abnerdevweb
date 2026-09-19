// =====================================================================
// MESA · delete-account
// Borra por completo la cuenta del usuario que la pide: sus imágenes de
// Storage, sus filas (se van solas por "on delete cascade") y el usuario
// de auth. Si tiene membresía en Stripe, la cancela.
//
// Desplegar: supabase functions deploy delete-account
// Secretos: STRIPE_SECRET_KEY (opcional)
// =====================================================================

import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { corsHeaders, json } from "../_shared/cors.ts";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

const BUCKETS = ["product-images", "avatars", "business-logos"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Sin sesión" }, 401);

  const { data: userData, error } = await admin.auth.getUser(token);
  if (error || !userData?.user) return json({ error: "Sesión inválida" }, 401);
  const userId = userData.user.id;

  // 1) Cancelar la membresía si existe
  if (STRIPE_KEY) {
    try {
      const stripe = new Stripe(STRIPE_KEY, {
        apiVersion: "2024-06-20",
        httpClient: Stripe.createFetchHttpClient(),
      });
      const { data: sub } = await admin
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (sub?.stripe_subscription_id) {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      }
    } catch (e) {
      console.error("No se pudo cancelar en Stripe", e);
    }
  }

  // 2) Borrar todas sus imágenes
  for (const bucket of BUCKETS) {
    const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
    if (files?.length) {
      await admin.storage
        .from(bucket)
        .remove(files.map((f) => `${userId}/${f.name}`));
    }
  }

  // 3) Borrar el usuario (las tablas caen en cascada)
  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) return json({ error: delErr.message }, 500);

  return json({ deleted: true });
});
