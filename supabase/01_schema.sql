-- =====================================================================
-- MESA · Punto de venta — Esquema completo de base de datos
-- Ejecutar en Supabase → SQL Editor (una sola vez, en este orden):
--   01_schema.sql  →  02_policies.sql  →  03_storage.sql
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PERFILES  (1 fila por usuario de auth)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  phone       text,
  country     text        not null default 'MX',
  name        text        not null default '',
  photo_path  text,                       -- ruta dentro del bucket "avatars"
  pin         text,                       -- PIN local de 4 dígitos (opcional)
  prefs       jsonb       not null default '{"notifSales":true,"notifStock":true,"notifDaily":false,"haptics":true,"bizOnTicket":true}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. NEGOCIO  (1 por usuario)
-- ---------------------------------------------------------------------
create table if not exists public.businesses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  name        text not null default '',
  type        text not null default '',
  address     text not null default '',
  phone       text not null default '',
  logo_path   text,                       -- ruta dentro del bucket "business-logos"
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. CATEGORÍAS
--    El id es texto porque la app lo genera ("bebidas", "c1712...").
--    La llave primaria es compuesta para que dos usuarios puedan
--    tener una categoría con el mismo id sin chocar.
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null,
  name        text not null default '',
  emoji       text not null default '🍽️',
  color       text not null default '#8A93AC',
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------
-- 4. PRODUCTOS
-- ---------------------------------------------------------------------
create table if not exists public.products (
  user_id     uuid not null references auth.users(id) on delete cascade,
  id          text not null,
  name        text not null default '',
  price       numeric(12,2) not null default 0,
  cost        numeric(12,2),
  category_id text,
  active      boolean not null default true,
  image_path  text,                       -- ruta dentro del bucket "product-images"
  position    int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, id),
  constraint products_category_fk
    foreign key (user_id, category_id)
    references public.categories(user_id, id)
    on delete set null
);
create index if not exists products_user_idx on public.products(user_id);

-- ---------------------------------------------------------------------
-- 5. MÉTODOS DE PAGO y TIPOS DE SERVICIO (configurables por usuario)
-- ---------------------------------------------------------------------
create table if not exists public.payment_methods (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         text not null,
  name       text not null,
  emoji      text not null default '💵',
  position   int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.service_types (
  user_id    uuid not null references auth.users(id) on delete cascade,
  id         text not null,
  name       text not null,
  emoji      text not null default '🍽️',
  position   int  not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------------
-- 6. VENTAS + PARTIDAS DE VENTA
-- ---------------------------------------------------------------------
create table if not exists public.sales (
  user_id        uuid not null references auth.users(id) on delete cascade,
  id             text not null,
  number         int  not null,
  sold_at        timestamptz not null default now(),
  subtotal       numeric(12,2) not null default 0,
  iva            numeric(12,2) not null default 0,
  total          numeric(12,2) not null default 0,
  service_type   text not null default 'comer',
  table_label    text not null default '',
  payment_method text not null default 'efectivo',
  cash           numeric(12,2),
  change         numeric(12,2),
  cancelled      boolean not null default false,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, number)
);
create index if not exists sales_user_date_idx on public.sales(user_id, sold_at desc);

create table if not exists public.sale_items (
  user_id    uuid not null references auth.users(id) on delete cascade,
  sale_id    text not null,
  line       int  not null,
  product_id text,
  name       text not null default '',
  price      numeric(12,2) not null default 0,
  cost       numeric(12,2),
  qty        numeric(12,3) not null default 1,
  primary key (user_id, sale_id, line),
  constraint sale_items_sale_fk
    foreign key (user_id, sale_id)
    references public.sales(user_id, id)
    on delete cascade
);
create index if not exists sale_items_sale_idx on public.sale_items(user_id, sale_id);

-- ---------------------------------------------------------------------
-- 7. CONFIGURACIÓN GENERAL (incluye el contador de folios de venta)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  iva_rate     numeric(5,4) not null default 0.16,
  sale_counter int not null default 0,
  data         jsonb not null default '{}'::jsonb,   -- cualquier ajuste futuro
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 8. MEMBRESÍA / PRUEBA GRATIS
--    status: trialing | active | past_due | canceled
--    Solo el service_role (webhook de Stripe) escribe aquí.
-- ---------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  status               text not null default 'trialing',
  trial_start          timestamptz not null default now(),
  trial_end            timestamptz not null default (now() + interval '60 days'),
  stripe_customer_id     text,
  stripe_subscription_id text,
  price_id             text,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at           timestamptz not null default now()
);
create index if not exists subscriptions_customer_idx on public.subscriptions(stripe_customer_id);

-- ---------------------------------------------------------------------
-- 9. ¿El usuario tiene acceso? (prueba vigente o membresía pagada)
--    Se usa en la app y también dentro de las políticas RLS de escritura.
-- ---------------------------------------------------------------------
create or replace function public.has_access(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = uid
      and (
            (s.status = 'trialing' and s.trial_end > now())
         or (s.status in ('active','past_due')
             and coalesce(s.current_period_end, now() + interval '1 day') > now())
      )
  );
$$;

grant execute on function public.has_access(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. ALTA AUTOMÁTICA DE CUENTA
--     Al crearse el usuario en auth.users se generan:
--     perfil, negocio vacío, configuración, prueba de 2 meses y los
--     catálogos operativos mínimos (formas de pago / tipos de servicio).
--     NO se crean productos ni ventas de ejemplo.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;

  insert into public.businesses (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.subscriptions (user_id, status, trial_start, trial_end)
  values (new.id, 'trialing', now(), now() + interval '60 days')
  on conflict (user_id) do nothing;

  insert into public.payment_methods (user_id, id, name, emoji, position) values
    (new.id, 'efectivo',      'Efectivo',      '💵', 0),
    (new.id, 'tarjeta',       'Tarjeta',       '💳', 1),
    (new.id, 'transferencia', 'Transferencia', '📲', 2)
  on conflict do nothing;

  insert into public.service_types (user_id, id, name, emoji, position) values
    (new.id, 'comer',     'Comer aquí',  '🍽️', 0),
    (new.id, 'llevar',    'Para llevar', '🥡', 1),
    (new.id, 'domicilio', 'Domicilio',   '🛵', 2)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 11. Folio de venta atómico (evita folios repetidos)
-- ---------------------------------------------------------------------
create or replace function public.next_sale_number()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  insert into public.settings (user_id, sale_counter)
  values (auth.uid(), 0)
  on conflict (user_id) do nothing;

  update public.settings
     set sale_counter = sale_counter + 1,
         updated_at = now()
   where user_id = auth.uid()
  returning sale_counter into n;

  return n;
end;
$$;

grant execute on function public.next_sale_number() to authenticated;

-- ---------------------------------------------------------------------
-- 12. updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','businesses','categories','products','sales','settings','subscriptions']
  loop
    execute format('drop trigger if exists touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;
