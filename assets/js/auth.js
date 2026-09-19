/* =====================================================================
   MESA · Acceso con WhatsApp
   ---------------------------------------------------------------------
   Supabase genera y verifica el código OTP.
   Supabase dispara el Send SMS Hook.
   La Edge Function "send-whatsapp-otp" entrega el OTP por WhatsApp.
===================================================================== */

(function () {
  'use strict';

  const Auth = {};

  /* -------------------------------------------------------------------
     Convierte número + país a formato E.164
     Ejemplo: 55 1234 5678 + México => +525512345678
  ------------------------------------------------------------------- */
  Auth.e164 = function (countryCode, digits) {
    const c = (typeof window.countryOf === 'function')
      ? window.countryOf(countryCode)
      : { dial: '+52' };

    return c.dial + String(digits).replace(/\D/g, '');
  };

  /* -------------------------------------------------------------------
     ENVÍA OTP
     
     IMPORTANTE:
     Usamos "sms" aquí porque Supabase necesita disparar el
     Send SMS Hook. Nuestra Edge Function convierte ese envío
     en un mensaje de WhatsApp.
  ------------------------------------------------------------------- */
  Auth.sendOtp = async function (phoneE164) {
    if (!window.SB) {
      return {
        ok: false,
        message: 'La app todavía no está conectada a Supabase.'
      };
    }

    console.log('[MESA AUTH] Solicitando OTP para:', phoneE164);

    const { error } = await SB.auth.signInWithOtp({
      phone: phoneE164,
      options: {
        channel: 'sms'
      }
    });

    if (error) {
      console.error('[MESA AUTH] Error al solicitar OTP:', error);

      return {
        ok: false,
        message: Auth.friendlyError(error)
      };
    }

    console.log('[MESA AUTH] OTP solicitado correctamente.');

    return {
      ok: true
    };
  };

  /* -------------------------------------------------------------------
     VERIFICA OTP
  ------------------------------------------------------------------- */
  Auth.verifyOtp = async function (phoneE164, token) {
    if (!window.SB) {
      return {
        ok: false,
        message: 'La app todavía no está conectada a Supabase.'
      };
    }

    console.log('[MESA AUTH] Verificando OTP para:', phoneE164);

    const { data, error } = await SB.auth.verifyOtp({
      phone: phoneE164,
      token: String(token),
      type: 'sms'
    });

    if (error) {
      console.error('[MESA AUTH] Error al verificar OTP:', error);

      return {
        ok: false,
        message: Auth.friendlyError(error)
      };
    }

    console.log('[MESA AUTH] OTP verificado correctamente.');

    return {
      ok: true,
      session: data.session,
      user: data.user
    };
  };

  /* -------------------------------------------------------------------
     SESIÓN ACTUAL
  ------------------------------------------------------------------- */
  Auth.session = async function () {
    if (!window.SB) return null;

    const { data } = await SB.auth.getSession();

    return data ? data.session : null;
  };

  /* -------------------------------------------------------------------
     CERRAR SESIÓN
  ------------------------------------------------------------------- */
  Auth.signOut = async function () {
    if (window.SB) {
      await SB.auth.signOut();
    }

    if (window.Store) {
      window.Store.reset();
    }
  };

  /* -------------------------------------------------------------------
     ELIMINAR CUENTA
  ------------------------------------------------------------------- */
  Auth.deleteAccount = async function () {
    if (!window.SB) {
      return {
        ok: false,
        message: 'Sin conexión con Supabase.'
      };
    }

    const { error } = await SB.functions.invoke(
      'delete-account',
      { body: {} }
    );

    if (error) {
      return {
        ok: false,
        message: 'No se pudo eliminar la cuenta: ' + error.message
      };
    }

    await Auth.signOut();

    return {
      ok: true
    };
  };

  /* -------------------------------------------------------------------
     ERROR
     
     Por ahora NO traducimos el error.
     Queremos ver exactamente qué está devolviendo Supabase.
  ------------------------------------------------------------------- */
  Auth.friendlyError = function (error) {
    console.error('[MESA AUTH] ERROR REAL:', error);

    return 'ERROR REAL: ' + (
      error?.message ||
      String(error)
    );
  };

  /* -------------------------------------------------------------------
     EXPONE AUTH GLOBALMENTE
  ------------------------------------------------------------------- */
  window.Auth = Auth;

})();
