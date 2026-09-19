/* =====================================================================
   MESA · Acceso con WhatsApp
   ---------------------------------------------------------------------
   Único método de entrada: número de celular + código de 6 dígitos que
   llega por WhatsApp.

   Supabase Auth genera, guarda y verifica el código.
   La Edge Function "send-whatsapp-otp" se encarga de entregarlo por
   WhatsApp.

   Si el número nunca había entrado, Supabase crea la cuenta y el
   disparador handle_new_user() arma el perfil, negocio y prueba.
===================================================================== */

(function () {
  const cfg = window.MESA_CONFIG || {};

  const Auth = {};

  /* ================================================================
     TELÉFONO
  ================================================================ */

  /**
   * Convierte el número introducido por el usuario a formato E.164.
   *
   * Ejemplo:
   * país: MX
   * número: 55 1234 5678
   * resultado: +525512345678
   */
  Auth.e164 = function (countryCode, digits) {
    const c = (typeof window.countryOf === 'function')
      ? window.countryOf(countryCode)
      : { dial: '+52' };

    return c.dial + String(digits).replace(/\D/g, '');
  };


  /* ================================================================
     ENVIAR OTP
  ================================================================ */

  /**
   * Pide a Supabase Auth que genere y envíe el código.
   *
   * Supabase genera el OTP.
   * El Send SMS Hook de Supabase llama a nuestra Edge Function.
   * La Edge Function entrega el OTP mediante WhatsApp Cloud API.
   */
  Auth.sendOtp = async function (phoneE164) {

    console.log('🔥 AUTH NUEVO');
    console.log('📱 Teléfono enviado a Supabase:', phoneE164);

    if (!window.SB) {
      console.error('❌ Supabase client no está disponible.');

      return {
        ok: false,
        message: 'La app todavía no está conectada a Supabase.'
      };
    }

    try {

      const { error } = await SB.auth.signInWithOtp({
        phone: phoneE164,

        /*
         * IMPORTANTE:
         * Supabase trabaja esto como SMS.
         * Nuestro Send SMS Hook se encarga de mandarlo realmente
         * por WhatsApp.
         */
        options: {
          channel: 'sms'
        }
      });

      if (error) {

        console.error('❌ ERROR SUPABASE signInWithOtp:', error);
        console.error('❌ Mensaje:', error.message);
        console.error('❌ Error completo:', error);

        return {
          ok: false,
          message: Auth.friendlyError(error)
        };
      }

      console.log('✅ Supabase aceptó la solicitud de OTP.');

      return {
        ok: true
      };

    } catch (error) {

      console.error('❌ EXCEPCIÓN en Auth.sendOtp:', error);

      return {
        ok: false,
        message: Auth.friendlyError(error)
      };
    }
  };


  /* ================================================================
     VERIFICAR OTP
  ================================================================ */

  /**
   * Verifica el código de 6 dígitos introducido por el usuario.
   */
  Auth.verifyOtp = async function (phoneE164, token) {

    console.log('🔐 Verificando OTP:', token);

    if (!window.SB) {

      return {
        ok: false,
        message: 'La app todavía no está conectada a Supabase.'
      };
    }

    try {

      const { data, error } = await SB.auth.verifyOtp({
        phone: phoneE164,
        token: String(token),
        type: 'sms'
      });

      if (error) {

        console.error('❌ ERROR verificando OTP:', error);

        return {
          ok: false,
          message: Auth.friendlyError(error)
        };
      }

      console.log('✅ OTP verificado correctamente.');

      return {
        ok: true,
        session: data.session,
        user: data.user
      };

    } catch (error) {

      console.error('❌ EXCEPCIÓN en Auth.verifyOtp:', error);

      return {
        ok: false,
        message: Auth.friendlyError(error)
      };
    }
  };


  /* ================================================================
     SESIÓN
  ================================================================ */

  Auth.session = async function () {

    if (!window.SB) return null;

    const { data } = await SB.auth.getSession();

    return data ? data.session : null;
  };


  /* ================================================================
     CERRAR SESIÓN
  ================================================================ */

  Auth.signOut = async function () {

    if (window.SB) {
      await SB.auth.signOut();
    }

    if (window.Store) {
      window.Store.reset();
    }
  };


  /* ================================================================
     ELIMINAR CUENTA
  ================================================================ */

  /**
   * Borra la cuenta completa mediante la Edge Function
   * "delete-account".
   */
  Auth.deleteAccount = async function () {

    if (!window.SB) {

      return {
        ok: false,
        message: 'Sin conexión con Supabase.'
      };
    }

    try {

      const { error } = await SB.functions.invoke(
        'delete-account',
        {
          body: {}
        }
      );

      if (error) {

        console.error('❌ Error eliminando cuenta:', error);

        return {
          ok: false,
          message: 'No se pudo eliminar la cuenta: ' + error.message
        };
      }

      await Auth.signOut();

      return {
        ok: true
      };

    } catch (error) {

      console.error('❌ Excepción eliminando cuenta:', error);

      return {
        ok: false,
        message: 'No se pudo eliminar la cuenta: ' + (
          error?.message || String(error)
        )
      };
    }
  };


  /* ================================================================
     MENSAJES DE ERROR
  ================================================================ */

  /**
   * DIAGNÓSTICO TEMPORAL.
   *
   * Por ahora NO ocultamos el error real de Supabase.
   * Esto nos permite saber exactamente qué está rechazando el envío.
   */
  Auth.friendlyError = function (error) {

    const message =
      error?.message ||
      String(error);

    console.error('🚨 ERROR REAL:', message);

    return 'ERROR REAL: ' + message;
  };


  /* ================================================================
     EXPONER AUTH
  ================================================================ */

  window.Auth = Auth;

  console.log('✅ MESA auth.js cargado correctamente');

})();