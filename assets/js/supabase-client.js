/* =====================================================================
   MESA · Cliente de Supabase
   Crea la conexión única que usa toda la app: window.SB
   (la librería del CDN se llama "supabase"; el cliente se llama "SB"
   para que no se confundan).
===================================================================== */
(function () {
  const cfg = window.MESA_CONFIG || {};

  const sinConfigurar =
    !cfg.SUPABASE_URL ||
    !cfg.SUPABASE_ANON_KEY ||
    cfg.SUPABASE_URL.includes('TU-PROYECTO') ||
    cfg.SUPABASE_ANON_KEY.includes('PEGA_AQUI');

  window.MESA_READY = !sinConfigurar;

  if (sinConfigurar) {
    window.SB = null;
    document.addEventListener('DOMContentLoaded', function () {
      const box = document.createElement('div');
      box.className = 'setup-warning';
      box.innerHTML =
        '<div class="setup-card">' +
        '<h2>Falta conectar Supabase</h2>' +
        '<p>Abre <code>assets/js/config.js</code> y pega tu <b>Project URL</b> y tu <b>anon key</b>. ' +
        'Están en Supabase → Project Settings → API.</p>' +
        '<p class="setup-hint">Mientras tanto la app no puede guardar nada.</p>' +
        '</div>';
      document.body.appendChild(box);
    });
    return;
  }

  window.SB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,      // la sesión se guarda cifrada por el SDK
      autoRefreshToken: true,
      detectSessionInUrl: false
    },
    global: {
      headers: { 'x-application-name': 'mesa-pos' }
    }
  });

  window.mesaLog = function () {
    if (window.MESA_CONFIG.DEBUG) console.log.apply(console, ['[mesa]'].concat([].slice.call(arguments)));
  };
})();
