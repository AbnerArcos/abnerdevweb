-- =====================================================================
-- MESA · Políticas de seguridad a nivel de fila (RLS)
-- Regla general: cada usuario SOLO ve y modifica sus propias filas.
-- Regla extra: si la prueba venció y no hay membresía activa, se puede
-- LEER (para no perder información) pero NO ESCRIBIR.
-- Ejecutar después de 01_schema.sql
-- =====================================================================

alter table public.profiles        enable row level security;
alter table public.businesses      enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.payment_methods enable row level security;
alter table public.service_types   enable row level security;
alter table public.sales           enable row level security;
alter table public.sale_items      enable row level security;
alter table public.settings        enable row level security;
alter table public.subscriptions   enable row level security;

-- ---------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated using (id = auth.uid());

-- ---------------------------------------------------------------------
-- BUSINESSES
-- ---------------------------------------------------------------------
drop policy if exists businesses_select on public.businesses;
create policy businesses_select on public.businesses
  for select to authenticated using (user_id = auth.uid());

drop policy if exists businesses_insert on public.businesses;
create policy businesses_insert on public.businesses
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists businesses_update on public.businesses;
create policy businesses_update on public.businesses
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists businesses_delete on public.businesses;
create policy businesses_delete on public.businesses
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- CATEGORIES  (escritura requiere acceso vigente)
-- ---------------------------------------------------------------------
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (user_id = auth.uid());

drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated with check (user_id = auth.uid() and public.has_access());

drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_access());

drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- PRODUCTS
-- ---------------------------------------------------------------------
drop policy if exists products_select on public.products;
create policy products_select on public.products
  for select to authenticated using (user_id = auth.uid());

drop policy if exists products_insert on public.products;
create policy products_insert on public.products
  for insert to authenticated with check (user_id = auth.uid() and public.has_access());

drop policy if exists products_update on public.products;
create policy products_update on public.products
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_access());

drop policy if exists products_delete on public.products;
create policy products_delete on public.products
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- PAYMENT METHODS / SERVICE TYPES
-- ---------------------------------------------------------------------
drop policy if exists payment_methods_all on public.payment_methods;
create policy payment_methods_all on public.payment_methods
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists service_types_all on public.service_types;
create policy service_types_all on public.service_types
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- SALES
-- ---------------------------------------------------------------------
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales
  for select to authenticated using (user_id = auth.uid());

drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales
  for insert to authenticated with check (user_id = auth.uid() and public.has_access());

drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_access());

drop policy if exists sales_delete on public.sales;
create policy sales_delete on public.sales
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- SALE ITEMS
-- ---------------------------------------------------------------------
drop policy if exists sale_items_select on public.sale_items;
create policy sale_items_select on public.sale_items
  for select to authenticated using (user_id = auth.uid());

drop policy if exists sale_items_insert on public.sale_items;
create policy sale_items_insert on public.sale_items
  for insert to authenticated with check (user_id = auth.uid() and public.has_access());

drop policy if exists sale_items_update on public.sale_items;
create policy sale_items_update on public.sale_items
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.has_access());

drop policy if exists sale_items_delete on public.sale_items;
create policy sale_items_delete on public.sale_items
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- SETTINGS
-- ---------------------------------------------------------------------
drop policy if exists settings_all on public.settings;
create policy settings_all on public.settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- SUBSCRIPTIONS
-- El usuario puede LEER su membresía, nunca escribirla.
-- Las escrituras vienen del webhook de Stripe con la service_role key,
-- que ignora RLS por diseño.
-- ---------------------------------------------------------------------
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated using (user_id = auth.uid());

-- (sin políticas de insert/update/delete para "authenticated": nadie
--  puede alargarse la prueba desde el navegador)
