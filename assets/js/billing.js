/* =====================================================================
   MESA · Prueba gratis y membresía
   ---------------------------------------------------------------------
   · Al crear la cuenta, el disparador de la base de datos deja 2 meses
     de prueba (tabla subscriptions). No se pide tarjeta.
   · Durante la prueba se ve una franja con los días que faltan.
   · Cuando la prueba termina y no hay membresía, la app se bloquea con
     una pantalla completa para activar los $129 MXN al mes.
   · El pago se hace en Stripe Checkout; quien decide si la cuenta está
     activa es el webhook, no el navegador (aquí no se puede hacer trampa:
     las políticas RLS también bloquean la escritura).
===================================================================== */
(function () {
  const cfg = window.MESA_CONFIG || {};
  const Billing = {};

  const DAY = 24 * 60 * 60 * 1000;

  Billing.info = function () {
    const s = (window.Store && window.Store.state.subscription) || null;
    if (!s) return { status: 'none', active: false, trialing: false, daysLeft: 0 };

    const now = Date.now();
    const trialEnd = s.trial_end ? new Date(s.trial_end).getTime() : 0;
    const periodEnd = s.current_period_end ? new Date(s.current_period_end).getTime() : 0;

    const trialing = s.status === 'trialing' && trialEnd > now;
    const paid = (s.status === 'active' || s.status === 'past_due') && (!periodEnd || periodEnd > now);

    return {
      status: s.status,
      active: trialing || paid,
      trialing: trialing,
      paid: paid,
      daysLeft: trialing ? Math.max(0, Math.ceil((trialEnd - now) / DAY)) : 0,
      trialEnd: s.trial_end,
      periodEnd: s.current_period_end,
      cancelAtPeriodEnd: !!s.cancel_at_period_end
    };
  };

  Billing.hasAccess = function () { return Billing.info().active; };

  /** Se llama antes de cualquier operación que escriba datos. */
  Billing.guard = function () {
    if (Billing.hasAccess()) return true;
    Billing.showPaywall();
    return false;
  };

  /* ---------------- Franja de prueba bajo el encabezado -------------- */
  Billing.paintBanner = function () {
    const app = document.querySelector('.app');
    const topbar = document.querySelector('.topbar');
    if (!app || !topbar) return;

    let strip = document.getElementById('trialStrip');
    const info = Billing.info();
    const logged = !!(window.Store && window.Store.ready);

    if (!logged || !info.trialing) {
      if (strip) strip.remove();
      return;
    }

    const urgent = info.daysLeft <= 7;
    const texto = info.daysLeft === 1
      ? 'Último día de tu prueba gratis'
      : 'Prueba gratis · te quedan ' + info.daysLeft + ' días';

    if (!strip) {
      strip = document.createElement('button');
      strip.id = 'trialStrip';
      strip.className = 'trial-strip';
      strip.type = 'button';
      strip.onclick = Billing.openMembership;
      topbar.insertAdjacentElement('afterend', strip);
    }
    strip.classList.toggle('urgent', urgent);
    strip.innerHTML =
      '<span class="trial-dot"></span>' +
      '<span class="trial-text">' + texto + '</span>' +
      '<span class="trial-cta">Ver membresía</span>';
  };

  /* ---------------- Aviso al registrarse ----------------------------- */
  Billing.welcomeNotice = function () {
    const info = Billing.info();
    const dias = info.daysLeft || cfg.TRIAL_DAYS || 60;
    window.openModal(`
      <h3 class="sheet-title">Tienes 2 meses gratis</h3>
      <p class="sheet-text">
        Tu cuenta queda activa hoy mismo con <b>${dias} días de prueba</b> y todas las
        funciones abiertas: ventas, historial, productos y reportes.
        <b>No pedimos tarjeta</b> durante la prueba.
      </p>
      <div class="plan-box">
        <div class="plan-row"><span>Hoy</span><b>$0</b></div>
        <div class="plan-row"><span>Al terminar la prueba</span><b>${cfg.MEMBERSHIP_LABEL || '$129 MXN al mes'}</b></div>
        <div class="plan-note">Te avisamos en la app antes de que se acabe. Si no activas la membresía, la app se pausa pero tus datos se quedan guardados.</div>
      </div>
      <div class="sheet-actions">
        <button class="btn primary block" onclick="closeModal()">Entendido, empezar</button>
      </div>
    `, { dismissible: true });
  };

  /* ---------------- Detalle de la membresía -------------------------- */
  Billing.openMembership = function () {
    const info = Billing.info();
    let estado = '';

    if (info.trialing) {
      estado = `<div class="plan-row"><span>Prueba gratis</span><b>${info.daysLeft} días restantes</b></div>
                <div class="plan-row"><span>Termina el</span><b>${fecha(info.trialEnd)}</b></div>`;
    } else if (info.paid) {
      estado = `<div class="plan-row"><span>Membresía</span><b>Activa</b></div>` +
               (info.periodEnd ? `<div class="plan-row"><span>${info.cancelAtPeriodEnd ? 'Termina el' : 'Se renueva el'}</span><b>${fecha(info.periodEnd)}</b></div>` : '');
    } else {
      estado = `<div class="plan-row"><span>Estado</span><b>Sin membresía</b></div>`;
    }

    window.openModal(`
      <h3 class="sheet-title">Membresía Mesa</h3>
      <div class="plan-box">
        <div class="plan-price">${cfg.MEMBERSHIP_LABEL || '$129 MXN al mes'}</div>
        ${estado}
        <div class="plan-note">Cancela cuando quieras desde esta misma pantalla.</div>
      </div>
      <div class="sheet-actions">
        ${info.paid
          ? `<button class="btn ghost block" onclick="Billing.openPortal(this)">Administrar mi pago</button>`
          : `<button class="btn primary block" id="payBtn" onclick="Billing.startCheckout(this)">Activar membresía</button>`}
        <button class="btn ghost block" onclick="closeModal()">Cerrar</button>
      </div>
    `, { dismissible: true });
  };

  function fecha(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  /* ---------------- Pantalla de bloqueo ------------------------------ */
  Billing.showPaywall = function () {
    if (document.getElementById('payLayer')) return;

    const layer = document.createElement('div');
    layer.id = 'payLayer';
    layer.className = 'pay-layer';
    layer.innerHTML = `
      <div class="pay-card">
        <div class="pay-illu">${window.ILLUSTRATIONS ? window.ILLUSTRATIONS.lockShield : ''}</div>
        <h1 class="auth-title" style="text-align:center;">Tu prueba gratis terminó</h1>
        <p class="auth-sub" style="text-align:center;">
          Activa tu membresía para seguir cobrando y ver tus reportes.
          Tus productos, ventas e historial siguen guardados.
        </p>
        <div class="plan-box">
          <div class="plan-price">${cfg.MEMBERSHIP_LABEL || '$129 MXN al mes'}</div>
          <div class="plan-note">Pago seguro con Stripe. Cancela cuando quieras.</div>
        </div>
        <div class="auth-actions">
          <button class="btn dark xl block" id="paywallBtn" onclick="Billing.startCheckout(this)">
            Activar membresía
          </button>
          <button class="btn ghost xl block" onclick="Billing.refresh(true)">Ya pagué, actualizar</button>
          <button class="btn ghost block" onclick="doLogout()">Cerrar sesión</button>
        </div>
        <p class="pay-foot" id="payError"></p>
      </div>`;
    document.body.appendChild(layer);
    document.body.classList.add('auth-open');
  };

  Billing.hidePaywall = function () {
    const layer = document.getElementById('payLayer');
    if (layer) layer.remove();
    if (!document.querySelector('.auth-layer.show')) document.body.classList.remove('auth-open');
  };

  /* ---------------- Stripe ------------------------------------------- */
  function loading(btn, on, textoOriginal) {
    if (!btn) return;
    btn.disabled = on;
    btn.classList.toggle('is-loading', on);
    btn.innerHTML = on ? '<span class="spinner"></span> Abriendo pago seguro…' : textoOriginal;
  }

  Billing.startCheckout = async function (btn) {
    const original = btn ? btn.innerHTML : '';
    const err = document.getElementById('payError');
    if (err) err.textContent = '';
    loading(btn, true, original);

    try {
      const { data, error } = await SB.functions.invoke('create-checkout-session', { body: {} });
      if (error || !data || !data.url) throw new Error((error && error.message) || (data && data.error) || 'sin url');
      window.location.href = data.url;
    } catch (e) {
      loading(btn, false, original || 'Activar membresía');
      const msg = 'No pudimos abrir el pago. Revisa tu conexión e inténtalo otra vez.';
      if (err) err.textContent = msg;
      else if (window.toast) window.toast(msg, { variant: 'toast-danger' });
    }
  };

  Billing.openPortal = async function (btn) {
    const original = btn ? btn.innerHTML : '';
    loading(btn, true, original);
    try {
      const { data, error } = await SB.functions.invoke('create-portal-session', { body: {} });
      if (error || !data || !data.url) throw new Error('sin url');
      window.location.href = data.url;
    } catch (e) {
      loading(btn, false, original || 'Administrar mi pago');
      if (window.toast) window.toast('No pudimos abrir el portal de pagos.', { variant: 'toast-danger' });
    }
  };

  /* ---------------- Refrescar estado --------------------------------- */
  Billing.refresh = async function (avisar) {
    if (!window.Store || !window.Store.ready) return;
    await window.Store.refreshSubscription();
    const info = Billing.info();

    if (info.active) {
      Billing.hidePaywall();
      if (avisar && window.toast) window.toast('Membresía activa', { variant: 'toast-success' });
    } else {
      Billing.showPaywall();
      if (avisar) {
        const err = document.getElementById('payError');
        if (err) err.textContent = 'Todavía no vemos el pago. Si acabas de pagar, espera unos segundos y vuelve a intentar.';
      }
    }
    Billing.paintBanner();
  };

  /** Después de volver de Stripe, el webhook tarda unos segundos. */
  Billing.pollAfterCheckout = async function () {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') !== 'success') return;

    history.replaceState({}, '', window.location.pathname);
    if (window.toast) window.toast('Confirmando tu pago…');

    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      await window.Store.refreshSubscription();
      if (Billing.info().active) {
        Billing.hidePaywall();
        Billing.paintBanner();
        if (window.toast) window.toast('¡Listo! Tu membresía está activa', { variant: 'toast-success' });
        return;
      }
    }
    if (window.toast) window.toast('El pago se está procesando. Si tarda, vuelve a abrir la app en un minuto.');
  };

  /** Revisa el estado al entrar y luego cada 6 horas. */
  Billing.start = function () {
    Billing.paintBanner();
    if (!Billing.hasAccess()) Billing.showPaywall(); else Billing.hidePaywall();
    Billing.pollAfterCheckout();
    clearInterval(Billing._t);
    Billing._t = setInterval(function () { Billing.refresh(false); }, 6 * 60 * 60 * 1000);
  };

  window.Billing = Billing;
})();
