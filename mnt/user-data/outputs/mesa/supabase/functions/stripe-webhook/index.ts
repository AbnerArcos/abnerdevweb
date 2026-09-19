// =====================================================================
// MESA · stripe-webhook
// Único lugar donde se decide si una cuenta tiene membresía activa.
// Stripe avisa aquí de cada pago, renovación, fallo o cancelación y la
// función actualiza la tabla subscriptions con la service_role key.
//
// Desplegar: supabase functions deploy stripe-webhook --no-verify-jwt
// (Stripe no manda token de usuario; la seguridad es la firma)
//
// Secretos: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// =====================================================================

import Stripe from "npm:stripe@16.12.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

/** Guarda el estado de la suscripción en la base de datos. */
async function saveSubscription(sub: Stripe.Subscription) {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // El id del usuario viaja en metadata; si no viene, se busca por cliente.
  let userId = sub.metadata?.supabase_user_id ?? null;
  if (!userId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    userId = data?.user_id ?? null;
  }
  if (!userId) {
    console.error("No se pudo asociar la suscripción con un usuario", sub.id);
    return;
  }

  const periodEnd = sub.current_period_end
    ? new Date(sub.current_period_end * 1000).toISOString()
    : null;

  // Stripe: active | trialing | past_due | canceled | unpaid | incomplete...
  let status = sub.status as string;
  if (status === "unpaid" || status === "incomplete_expired") status = "canceled";
  if (status === "incomplete") status = "past_due";

  await admin
    .from("subscriptions")
    .update({
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: sub.id,
      price_id: sub.items.data[0]?.price?.id ?? null,
      current_period_end: periodEnd,
      cancel_at_period_end: sub.cancel_at_period_end ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Sin firma", { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, WEBHOOK_SECRET);
  } catch (err) {
    console.error("Firma de Stripe inválida", err);
    return new Response("Firma inválida", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.supabase_user_id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

        if (userId && customerId) {
          await admin
            .from("subscriptions")
            .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          if (userId && !sub.metadata?.supabase_user_id) {
            await stripe.subscriptions.update(sub.id, {
              metadata: { supabase_user_id: userId },
            });
            sub.metadata = { ...sub.metadata, supabase_user_id: userId };
          }
          await saveSubscription(sub);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await saveSubscription(event.data.object as Stripe.Subscription);
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await saveSubscription(sub);
        }
        break;
      }
    }
  } catch (err) {
    console.error("Error procesando el evento", event.type, err);
    return new Response("Error interno", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
