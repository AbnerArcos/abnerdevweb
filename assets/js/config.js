/* =====================================================================
   MESA · Configuración de la app
   ---------------------------------------------------------------------
   ESTE ES EL ÚNICO ARCHIVO QUE TIENES QUE EDITAR PARA CONECTAR TUS
   CUENTAS. Copia aquí los dos datos públicos de tu proyecto Supabase
   (Project URL y anon key). NO pongas aquí la service_role key ni las
   llaves de Stripe: esas van en los secretos de las Edge Functions.
===================================================================== */
window.MESA_CONFIG = {

  /* --- Supabase (Project Settings → API) ---------------------------- */
  SUPABASE_URL:      'https://plgokdfnyqpxfxkctdiu.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_dkGLyNLy-VaeiYRLsxLG4w_bkwzHIBW',

  /* --- Acceso ------------------------------------------------------- */
  OTP_CHANNEL: 'whatsapp',   // 'whatsapp' en producción. 'sms' solo para pruebas.
  OTP_LENGTH: 6,
  RESEND_SECONDS: 45,

  /* --- Prueba gratis y membresía ------------------------------------ */
  TRIAL_DAYS: 60,                     // 2 meses (debe coincidir con el SQL)
  MEMBERSHIP_PRICE: 129,
  MEMBERSHIP_CURRENCY: 'MXN',
  MEMBERSHIP_LABEL: '$129 MXN al mes',

  /* --- Imágenes ----------------------------------------------------- */
  BUCKET_PRODUCTS: 'product-images',
  BUCKET_AVATARS:  'avatars',
  BUCKET_LOGOS:    'business-logos',
  PUBLIC_BUCKETS:  false,   // false = buckets privados con URL firmada (recomendado)
  SIGNED_URL_TTL:  3600,    // segundos que dura la URL firmada de cada imagen

  /* --- Comportamiento ----------------------------------------------- */
  DEBUG: false              // true = muestra en consola cada operación con Supabase
};
