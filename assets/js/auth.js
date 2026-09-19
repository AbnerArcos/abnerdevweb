/* =====================================================================
   MESA · Acceso con WhatsApp
   ---------------------------------------------------------------------
   Único método de entrada: número de celular + código de 6 dígitos que
   llega por WhatsApp. No hay correo, ni Google, ni Apple.

   Supabase Auth genera, guarda y verifica el código; la Edge Function
   "send-whatsapp-otp" solo lo entrega por WhatsApp. Si el número nunca
   había entrado, Supabase crea la cuenta sola y el disparador
   handle_new_user() arma el perfil, el negocio y la prueba de 2 meses.
===================================================================== */
(function () {
  const cfg = window.MESA_CONFIG || {};

  const Auth = {};

  /** Convierte "55 1234 5678" + país en el formato internacional +525512345678 */
  Auth.e164 = function (countryCode, digits) {
    const c = (typeof window.countryOf === 'function')
      ? window.countryOf(countryCode)
      : { dial: '+52' };
    return c.dial + String(digits).replace(/\D/g, '');
  };

  /** Envía el código por WhatsApp. Devuelve {ok:true} o {ok:false, message}. */
  Auth.sendOtp = async function (phoneE164) {
    if (!window.SB) return { ok: false, message: 'La app todavía no está conectada a Supabase.' };
    const { error } = await SB.auth.signInWithOtp({
      phone: phoneE164,
      options: { channel: cfg.OTP_CHANNEL || 'whatsapp' }
    });
    if (error) return { ok: false, message: Auth.friendlyError(error) };
    return { ok: true };
  };

  /** Verifica el código. Si es correcto deja la sesión abierta. */
  Auth.verifyOtp = async function (phoneE164, token) {
    if (!window.SB) return { ok: false, message: 'La app todavía no está conectada a Supabase.' };
    const { data, error } = await SB.auth.verifyOtp({
      phone: phoneE164,
      token: String(token),
      type: 'sms'
    });
    if (error) return { ok: false, message: Auth.friendlyError(error) };
    return { ok: true, session: data.session, user: data.user };
  };

  Auth.session = async function () {
    if (!window.SB) return null;
    const { data } = await SB.auth.getSession();
    return data ? data.session : null;
  };

  Auth.signOut = async function () {
    if (window.SB) await SB.auth.signOut();
    if (window.Store) window.Store.reset();
  };

  /** Borra la cuenta completa (imágenes, datos y usuario) vía Edge Function. */
  Auth.deleteAccount = async function () {
    if (!window.SB) return { ok: false, message: 'Sin conexión con Supabase.' };
    const { error } = await SB.functions.invoke('delete-account', { body: {} });
    if (error) return { ok: false, message: 'No se pudo eliminar la cuenta: ' + error.message };
    await Auth.signOut();
    return { ok: true };
  };

  /** Traduce los errores de Supabase a algo que un usuario entienda. */
  Auth.friendlyError = function (error) {
    const msg = (error && error.message ? error.message : String(error)).toLowerCase();

    if (msg.includes('invalid') && msg.includes('otp')) return 'Ese código no coincide o ya venció. Pide uno nuevo.';
    if (msg.includes('token has expired') || msg.includes('expired')) return 'El código ya venció. Pide uno nuevo.';
    if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('60 seconds')) {
      return 'Pediste muchos códigos seguidos. Espera un minuto e inténtalo otra vez.';
    }
    if (msg.includes('invalid phone') || msg.includes('phone')) {
    return 'ERROR REAL: ' + (error?.message || String(error));
    }
    if (msg.includes('signups not allowed')) return 'Los registros nuevos están cerrados en este momento.';
    if (msg.includes('failed to fetch') || msg.includes('network')) return 'Sin internet. Revisa tu conexión e inténtalo otra vez.';
    if (msg.includes('sms provider') || msg.includes('hook')) return 'No pudimos enviar el mensaje de WhatsApp. Inténtalo en un minuto.';
    return 'No pudimos continuar. Inténtalo otra vez en un momento.';
  };

  window.Auth = Auth;
})();
