// Cabeceras CORS compartidas por las funciones que llama el navegador.
// Si quieres cerrarlo a tu dominio, cambia "*" por "https://tudominio.com".
export const ALLOWED_ORIGIN = Deno.env.get("APP_URL") ?? "*";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
