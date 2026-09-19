/* =====================================================================
   MESA · Store
   ---------------------------------------------------------------------
   Puente entre la app (que lee y escribe de forma inmediata) y Supabase
   (que responde por internet). Funciona así:

     1. Al entrar, se descarga TODO lo del usuario una sola vez
        (hydrate) y queda en memoria.
     2. La app lee siempre de esa copia en memoria: la pantalla nunca
        se queda esperando.
     3. Cada vez que la app guarda algo, el Store calcula qué cambió y
        lo manda a Supabase en segundo plano (write-through).
     4. Si no hay internet, los cambios se guardan en una cola y se
        reintentan solos cuando vuelve la señal. Nada se pierde.

   Las imágenes NUNCA se guardan en base64: se suben a Supabase Storage
   y en la base de datos solo queda la ruta del archivo.
===================================================================== */
(function () {
  const cfg = window.MESA_CONFIG || {};
  const log = window.mesaLog || function () {};

  const Store = {
    ready: false,
    userId: null,
    state: {
      profile: null,
      business: null,
      categories: [],
      products: [],
      sales: [],
      paymentMethods: [],
      serviceTypes: [],
      settings: { iva_rate: 0.16, sale_counter: 0, data: {} },
      subscription: null
    },
    counter: 0,
    pending: 0,
    lastError: null
  };

  /* ---------------------------------------------------------------
     Utilidades
  --------------------------------------------------------------- */
  const isDataUrl = (v) => typeof v === 'string' && v.startsWith('data:');
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

  function randomName() {
    return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)) + '.jpg';
  }

  function dataUrlToBlob(dataUrl) {
    const [head, body] = dataUrl.split(',');
    const mime = (head.match(/:(.*?);/) || [null, 'image/jpeg'])[1];
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  /* ---------------------------------------------------------------
     Imágenes: subir, resolver URL y borrar
  --------------------------------------------------------------- */
  const urlCache = new Map();   // ruta -> url mostrable

  async function uploadImage(bucket, dataUrl) {
    const path = Store.userId + '/' + randomName();
    const blob = dataUrlToBlob(dataUrl);
    const { error } = await SB.storage.from(bucket).upload(path, blob, {
      contentType: blob.type || 'image/jpeg',
      upsert: false,
      cacheControl: '3600'
    });
    if (error) throw error;
    return path;
  }

  async function removeImage(bucket, path) {
    if (!path) return;
    urlCache.delete(bucket + '|' + path);
    try { await SB.storage.from(bucket).remove([path]); }
    catch (e) { log('no se pudo borrar la imagen', path, e); }
  }

  async function resolveUrls(bucket, paths) {
    const missing = paths.filter((p) => p && !urlCache.has(bucket + '|' + p));
    if (!missing.length) return;

    if (cfg.PUBLIC_BUCKETS) {
      missing.forEach((p) => {
        const { data } = SB.storage.from(bucket).getPublicUrl(p);
        urlCache.set(bucket + '|' + p, data.publicUrl);
      });
      return;
    }
    const { data, error } = await SB.storage
      .from(bucket)
      .createSignedUrls(missing, cfg.SIGNED_URL_TTL || 3600);
    if (error) { log('no se pudieron firmar imágenes', error); return; }
    (data || []).forEach((row) => {
      if (row.signedUrl && !row.error) urlCache.set(bucket + '|' + row.path, row.signedUrl);
    });
  }

  const urlOf = (bucket, path) => (path ? urlCache.get(bucket + '|' + path) || null : null);

  /* ---------------------------------------------------------------
     Traductores fila de Supabase  <->  objeto de la app
  --------------------------------------------------------------- */
  const M = {
    category: {
      fromRow: (r) => ({ id: r.id, name: r.name, emoji: r.emoji, color: r.color }),
      toRow: (c, i) => ({
        user_id: Store.userId, id: c.id, name: c.name || '',
        emoji: c.emoji || '🍽️', color: c.color || '#8A93AC', position: i
      })
    },
    product: {
      fromRow: (r) => ({
        id: r.id, name: r.name, price: Number(r.price),
        cost: r.cost === null ? null : Number(r.cost),
        category: r.category_id, active: !!r.active,
        image_path: r.image_path || null,
        image: urlOf(cfg.BUCKET_PRODUCTS, r.image_path)
      }),
      toRow: (p, i) => ({
        user_id: Store.userId, id: p.id, name: p.name || '',
        price: num(p.price) || 0,
        cost: p.cost === null || p.cost === undefined ? null : num(p.cost),
        category_id: p.category || null,
        active: p.active !== false,
        image_path: p.image_path || null,
        position: i
      })
    },
    sale: {
      fromRow: (r) => ({
        id: r.id,
        number: r.number,
        date: r.sold_at,
        subtotal: Number(r.subtotal),
        iva: Number(r.iva),
        total: Number(r.total),
        serviceType: r.service_type,
        table: r.table_label || '',
        paymentMethod: r.payment_method,
        cash: r.cash === null ? null : Number(r.cash),
        change: r.change === null ? null : Number(r.change),
        cancelled: !!r.cancelled,
        cancelledAt: r.cancelled_at || null,
        items: (r.sale_items || [])
          .slice()
          .sort((a, b) => a.line - b.line)
          .map((it) => ({
            productId: it.product_id,
            name: it.name,
            price: Number(it.price),
            cost: it.cost === null ? null : Number(it.cost),
            qty: Number(it.qty)
          }))
      }),
      toRow: (s) => ({
        user_id: Store.userId, id: s.id, number: s.number,
        sold_at: s.date, subtotal: num(s.subtotal) || 0,
        iva: num(s.iva) || 0, total: num(s.total) || 0,
        service_type: s.serviceType || 'comer',
        table_label: s.table || '',
        payment_method: s.paymentMethod || 'efectivo',
        cash: s.cash === null || s.cash === undefined ? null : num(s.cash),
        change: s.change === null || s.change === undefined ? null : num(s.change),
        cancelled: !!s.cancelled,
        cancelled_at: s.cancelled ? (s.cancelledAt || s.date) : null
      }),
      itemRows: (s) => (s.items || []).map((it, line) => ({
        user_id: Store.userId, sale_id: s.id, line: line,
        product_id: it.productId || null, name: it.name || '',
        price: num(it.price) || 0,
        cost: it.cost === null || it.cost === undefined ? null : num(it.cost),
        qty: num(it.qty) || 1
      }))
    }
  };

  /* ---------------------------------------------------------------
     Carga inicial
  --------------------------------------------------------------- */
  Store.hydrate = async function () {
    const { data: sessionData } = await SB.auth.getSession();
    const session = sessionData && sessionData.session;
    if (!session) { Store.ready = false; Store.userId = null; return false; }

    Store.userId = session.user.id;

    const [profile, business, categories, products, sales, items, pays, services, settings, sub] = await Promise.all([
      SB.from('profiles').select('*').eq('id', Store.userId).maybeSingle(),
      SB.from('businesses').select('*').eq('user_id', Store.userId).maybeSingle(),
      SB.from('categories').select('*').order('position'),
      SB.from('products').select('*').order('position'),
      SB.from('sales').select('*').order('sold_at', { ascending: true }),
      SB.from('sale_items').select('*').order('line'),
      SB.from('payment_methods').select('*').order('position'),
      SB.from('service_types').select('*').order('position'),
      SB.from('settings').select('*').eq('user_id', Store.userId).maybeSingle(),
      SB.from('subscriptions').select('*').eq('user_id', Store.userId).maybeSingle()
    ]);

    const firstError = [profile, business, categories, products, sales, items, pays, services, settings, sub]
      .map((r) => r.error).find(Boolean);
    if (firstError) { Store.lastError = firstError; throw firstError; }

    // Imágenes: se firman todas de golpe antes de armar los objetos
    await Promise.all([
      resolveUrls(cfg.BUCKET_PRODUCTS, (products.data || []).map((p) => p.image_path).filter(Boolean)),
      resolveUrls(cfg.BUCKET_AVATARS, [profile.data && profile.data.photo_path].filter(Boolean)),
      resolveUrls(cfg.BUCKET_LOGOS, [business.data && business.data.logo_path].filter(Boolean))
    ]);

    Store.state.profile = profile.data
      ? {
          id: profile.data.id,
          name: profile.data.name || '',
          phone: profile.data.phone || '',
          country: profile.data.country || 'MX',
          pin: profile.data.pin || null,
          prefs: profile.data.prefs || {},
          photo_path: profile.data.photo_path || null,
          photo: urlOf(cfg.BUCKET_AVATARS, profile.data.photo_path),
          createdAt: profile.data.created_at
        }
      : null;

    Store.state.business = business.data
      ? {
          name: business.data.name || '', type: business.data.type || '',
          address: business.data.address || '', phone: business.data.phone || '',
          logo_path: business.data.logo_path || null,
          logo: urlOf(cfg.BUCKET_LOGOS, business.data.logo_path)
        }
      : { name: '', type: '', address: '', phone: '', logo_path: null, logo: null };

    Store.state.categories = (categories.data || []).map(M.category.fromRow);
    Store.state.products = (products.data || []).map(M.product.fromRow);
    // Las partidas se traen aparte y se pegan a su venta (más rápido y sin
    // depender de relaciones anidadas).
    const porVenta = new Map();
    (items.data || []).forEach((it) => {
      if (!porVenta.has(it.sale_id)) porVenta.set(it.sale_id, []);
      porVenta.get(it.sale_id).push(it);
    });
    Store.state.sales = (sales.data || []).map((r) =>
      M.sale.fromRow(Object.assign({}, r, { sale_items: porVenta.get(r.id) || [] })));
    Store.state.paymentMethods = (pays.data || []).map((r) => ({ id: r.id, name: r.name, emoji: r.emoji }));
    Store.state.serviceTypes = (services.data || []).map((r) => ({ id: r.id, name: r.name, emoji: r.emoji }));
    Store.state.settings = settings.data || { iva_rate: 0.16, sale_counter: 0, data: {} };
    Store.state.subscription = sub.data || null;

    const maxNumber = Store.state.sales.reduce((m, s) => Math.max(m, s.number || 0), 0);
    Store.counter = Math.max(Number(Store.state.settings.sale_counter || 0), maxNumber);

    snapshot();
    Store.ready = true;
    loadOutbox();
    flush();
    return true;
  };

  Store.reset = function () {
    Store.ready = false;
    Store.userId = null;
    Store.counter = 0;
    Store.state = {
      profile: null, business: null, categories: [], products: [], sales: [],
      paymentMethods: [], serviceTypes: [],
      settings: { iva_rate: 0.16, sale_counter: 0, data: {} }, subscription: null
    };
    queue.length = 0;
    urlCache.clear();
    snap = { categories: new Map(), products: new Map(), sales: new Map(), items: new Map() };
  };

  /* ---------------------------------------------------------------
     Instantánea para comparar qué cambió
  --------------------------------------------------------------- */
  let snap = { categories: new Map(), products: new Map(), sales: new Map(), items: new Map() };

  function snapshot() {
    snap.categories = new Map(Store.state.categories.map((c, i) => [c.id, JSON.stringify(M.category.toRow(c, i))]));
    snap.products = new Map(Store.state.products.map((p, i) => [p.id, JSON.stringify(M.product.toRow(p, i))]));
    snap.sales = new Map(Store.state.sales.map((s) => [s.id, JSON.stringify(M.sale.toRow(s))]));
    snap.items = new Map(Store.state.sales.map((s) => [s.id, JSON.stringify(M.sale.itemRows(s))]));
  }

  /* ---------------------------------------------------------------
     Cola de escritura (sobrevive a cierres y a la falta de internet)
  --------------------------------------------------------------- */
  const queue = [];
  let flushing = false;

  function outboxKey() { return 'mesa_outbox_' + (Store.userId || 'anon'); }

  function saveOutbox() {
    try { localStorage.setItem(outboxKey(), JSON.stringify(queue)); }
    catch (e) { log('no se pudo guardar la cola', e); }
  }
  function loadOutbox() {
    try {
      const raw = localStorage.getItem(outboxKey());
      if (raw) JSON.parse(raw).forEach((op) => queue.push(op));
    } catch (e) { log('cola ilegible', e); }
  }

  function enqueue(op) {
    queue.push(op);
    Store.pending = queue.length;
    saveOutbox();
    notify();
    flush();
  }

  const listeners = [];
  Store.onSync = function (cb) { listeners.push(cb); };
  function notify() {
    listeners.forEach((cb) => {
      try { cb({ pending: queue.length, error: Store.lastError, online: navigator.onLine }); }
      catch (e) { log(e); }
    });
  }

  async function runOp(op) {
    if (op.kind === 'upsert') {
      const { error } = await SB.from(op.table).upsert(op.rows, { onConflict: op.conflict });
      if (error) throw error;
    } else if (op.kind === 'delete') {
      let q = SB.from(op.table).delete().eq('user_id', Store.userId);
      if (op.column) q = q.in(op.column, op.values);
      const { error } = await q;
      if (error) throw error;
    } else if (op.kind === 'update') {
      const { error } = await SB.from(op.table).update(op.values).eq(op.key, op.keyValue);
      if (error) throw error;
    } else if (op.kind === 'upload') {
      // Sube una imagen y deja la ruta en la fila correspondiente
      const path = await uploadImage(op.bucket, op.dataUrl);
      if (op.table === 'products') {
        const p = Store.state.products.find((x) => x.id === op.id);
        if (p) { p.image_path = path; }
        await resolveUrls(op.bucket, [path]);
        if (p) p.image = urlOf(op.bucket, path);
        const { error } = await SB.from('products').update({ image_path: path })
          .eq('user_id', Store.userId).eq('id', op.id);
        if (error) throw error;
      } else if (op.table === 'profiles') {
        await resolveUrls(op.bucket, [path]);
        if (Store.state.profile) {
          Store.state.profile.photo_path = path;
          Store.state.profile.photo = urlOf(op.bucket, path);
        }
        const { error } = await SB.from('profiles').update({ photo_path: path }).eq('id', Store.userId);
        if (error) throw error;
      } else if (op.table === 'businesses') {
        await resolveUrls(op.bucket, [path]);
        if (Store.state.business) {
          Store.state.business.logo_path = path;
          Store.state.business.logo = urlOf(op.bucket, path);
        }
        const { error } = await SB.from('businesses').update({ logo_path: path }).eq('user_id', Store.userId);
        if (error) throw error;
      }
      if (op.replaces) await removeImage(op.bucket, op.replaces);
      snapshot();
      if (typeof window.mesaRepaint === 'function') window.mesaRepaint();
    } else if (op.kind === 'removeImage') {
      await removeImage(op.bucket, op.path);
    }
  }

  async function flush() {
    if (flushing || !Store.ready || !queue.length) return;
    if (!navigator.onLine) { notify(); return; }
    flushing = true;

    while (queue.length) {
      const op = queue[0];
      try {
        await runOp(op);
        queue.shift();
        Store.lastError = null;
      } catch (err) {
        log('error al sincronizar', op, err);
        Store.lastError = err;
        const code = err && (err.code || err.status);
        // 42501 = RLS bloqueó la escritura (prueba vencida o dato ajeno).
        // Se descarta la operación para no bloquear la cola para siempre.
        if (code === '42501' || code === 403) {
          queue.shift();
          if (window.Billing && typeof window.Billing.refresh === 'function') window.Billing.refresh();
        } else {
          flushing = false;
          Store.pending = queue.length;
          saveOutbox();
          notify();
          setTimeout(flush, 8000);
          return;
        }
      }
      Store.pending = queue.length;
      saveOutbox();
      notify();
    }

    flushing = false;
    saveOutbox();
    notify();
  }

  Store.flush = flush;
  window.addEventListener('online', flush);
  window.addEventListener('offline', notify);

  /* ---------------------------------------------------------------
     Guardado de listas (diferencia contra la instantánea)
  --------------------------------------------------------------- */
  Store.saveCategories = function (list) {
    Store.state.categories = list;
    if (!Store.ready) return;

    const rows = list.map((c, i) => M.category.toRow(c, i));
    const changed = rows.filter((r) => snap.categories.get(r.id) !== JSON.stringify(r));
    const gone = [...snap.categories.keys()].filter((id) => !list.some((c) => c.id === id));

    if (changed.length) enqueue({ kind: 'upsert', table: 'categories', rows: changed, conflict: 'user_id,id' });
    if (gone.length) enqueue({ kind: 'delete', table: 'categories', column: 'id', values: gone });
    snapshot();
  };

  Store.saveProducts = function (list) {
    Store.state.products = list;
    if (!Store.ready) return;

    const uploads = [];
    list.forEach((p) => {
      if (isDataUrl(p.image)) {
        uploads.push({
          kind: 'upload', bucket: cfg.BUCKET_PRODUCTS, table: 'products',
          id: p.id, dataUrl: p.image, replaces: p.image_path || null
        });
      } else if (!p.image && p.image_path) {
        // el usuario quitó la foto
        uploads.push({ kind: 'removeImage', bucket: cfg.BUCKET_PRODUCTS, path: p.image_path });
        p.image_path = null;
      }
    });

    const rows = list.map((p, i) => M.product.toRow(p, i));
    const changed = rows.filter((r) => snap.products.get(r.id) !== JSON.stringify(r));
    const gone = [...snap.products.keys()].filter((id) => !list.some((p) => p.id === id));

    // Al borrar un producto, se borra también su foto del Storage
    gone.forEach((id) => {
      const prev = snap.products.get(id);
      try {
        const path = JSON.parse(prev).image_path;
        if (path) enqueue({ kind: 'removeImage', bucket: cfg.BUCKET_PRODUCTS, path: path });
      } catch (e) { /* ignorar */ }
    });

    if (changed.length) enqueue({ kind: 'upsert', table: 'products', rows: changed, conflict: 'user_id,id' });
    if (gone.length) enqueue({ kind: 'delete', table: 'products', column: 'id', values: gone });
    uploads.forEach(enqueue);
    snapshot();
  };

  Store.saveSales = function (list) {
    Store.state.sales = list;
    if (!Store.ready) return;

    list.forEach((s) => {
      const row = M.sale.toRow(s);
      const rowJson = JSON.stringify(row);
      const items = M.sale.itemRows(s);
      const itemsJson = JSON.stringify(items);

      if (snap.sales.get(s.id) !== rowJson) {
        enqueue({ kind: 'upsert', table: 'sales', rows: [row], conflict: 'user_id,id' });
      }
      if (snap.items.get(s.id) !== itemsJson && items.length) {
        enqueue({ kind: 'delete', table: 'sale_items', column: 'sale_id', values: [s.id] });
        enqueue({ kind: 'upsert', table: 'sale_items', rows: items, conflict: 'user_id,sale_id,line' });
      }
    });

    const gone = [...snap.sales.keys()].filter((id) => !list.some((s) => s.id === id));
    if (gone.length) enqueue({ kind: 'delete', table: 'sales', column: 'id', values: gone });

    snapshot();
  };

  /* ---------------------------------------------------------------
     Perfil, negocio y configuración
  --------------------------------------------------------------- */
  Store.saveProfile = function (patch) {
    Store.state.profile = Object.assign({}, Store.state.profile || {}, patch);
    if (!Store.ready) return;

    const p = Store.state.profile;
    const values = {
      name: p.name || '', country: p.country || 'MX',
      pin: p.pin || null, prefs: p.prefs || {}
    };
    if (patch.phone !== undefined) values.phone = patch.phone;

    if (isDataUrl(p.photo)) {
      enqueue({
        kind: 'upload', bucket: cfg.BUCKET_AVATARS, table: 'profiles',
        dataUrl: p.photo, replaces: p.photo_path || null
      });
    } else if (!p.photo && p.photo_path) {
      enqueue({ kind: 'removeImage', bucket: cfg.BUCKET_AVATARS, path: p.photo_path });
      values.photo_path = null;
      p.photo_path = null;
    }

    enqueue({ kind: 'update', table: 'profiles', values: values, key: 'id', keyValue: Store.userId });
  };

  Store.saveBusiness = function (biz) {
    Store.state.business = Object.assign({}, Store.state.business || {}, biz);
    if (!Store.ready) return;

    const b = Store.state.business;
    const values = {
      name: b.name || '', type: b.type || '',
      address: b.address || '', phone: b.phone || ''
    };

    if (isDataUrl(b.logo)) {
      enqueue({
        kind: 'upload', bucket: cfg.BUCKET_LOGOS, table: 'businesses',
        dataUrl: b.logo, replaces: b.logo_path || null
      });
    } else if (!b.logo && b.logo_path) {
      enqueue({ kind: 'removeImage', bucket: cfg.BUCKET_LOGOS, path: b.logo_path });
      values.logo_path = null;
      b.logo_path = null;
    }

    enqueue({ kind: 'update', table: 'businesses', values: values, key: 'user_id', keyValue: Store.userId });
  };

  Store.saveSettings = function (patch) {
    Store.state.settings = Object.assign({}, Store.state.settings, patch);
    if (!Store.ready) return;
    enqueue({
      kind: 'update', table: 'settings',
      values: {
        iva_rate: Store.state.settings.iva_rate,
        sale_counter: Store.state.settings.sale_counter,
        data: Store.state.settings.data || {}
      },
      key: 'user_id', keyValue: Store.userId
    });
  };

  Store.nextSaleNumber = function () {
    Store.counter += 1;
    Store.saveSettings({ sale_counter: Store.counter });
    return Store.counter;
  };

  Store.refreshSubscription = async function () {
    if (!Store.userId) return null;
    const { data, error } = await SB.from('subscriptions').select('*').eq('user_id', Store.userId).maybeSingle();
    if (!error) Store.state.subscription = data || null;
    return Store.state.subscription;
  };

  /* Renueva las URLs firmadas antes de que caduquen */
  Store.refreshImageUrls = async function () {
    urlCache.clear();
    const paths = Store.state.products.map((p) => p.image_path).filter(Boolean);
    await resolveUrls(cfg.BUCKET_PRODUCTS, paths);
    Store.state.products.forEach((p) => { p.image = urlOf(cfg.BUCKET_PRODUCTS, p.image_path); });

    if (Store.state.profile && Store.state.profile.photo_path) {
      await resolveUrls(cfg.BUCKET_AVATARS, [Store.state.profile.photo_path]);
      Store.state.profile.photo = urlOf(cfg.BUCKET_AVATARS, Store.state.profile.photo_path);
    }
    if (Store.state.business && Store.state.business.logo_path) {
      await resolveUrls(cfg.BUCKET_LOGOS, [Store.state.business.logo_path]);
      Store.state.business.logo = urlOf(cfg.BUCKET_LOGOS, Store.state.business.logo_path);
    }
    if (typeof window.mesaRepaint === 'function') window.mesaRepaint();
  };

  if (!cfg.PUBLIC_BUCKETS) {
    setInterval(function () {
      if (Store.ready) Store.refreshImageUrls();
    }, Math.max(((cfg.SIGNED_URL_TTL || 3600) * 0.8) * 1000, 300000));
  }

  window.Store = Store;
})();
