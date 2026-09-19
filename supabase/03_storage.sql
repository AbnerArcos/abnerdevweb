-- =====================================================================
-- MESA · Buckets de Storage y sus políticas
-- Las imágenes se guardan como archivos reales (jpg), nunca en base64.
-- Ruta obligatoria de cada archivo:  <user_id>/<nombre-aleatorio>.jpg
-- Los buckets son PRIVADOS: la app muestra las fotos con URLs firmadas.
-- Ejecutar después de 02_policies.sql
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('avatars',        'avatars',        false, 5242880, array['image/jpeg','image/png','image/webp']),
  ('business-logos', 'business-logos', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- Cada usuario manda y lee SOLO dentro de la carpeta con su propio id.
-- ---------------------------------------------------------------------
drop policy if exists "mesa_images_select" on storage.objects;
create policy "mesa_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('product-images','avatars','business-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "mesa_images_insert" on storage.objects;
create policy "mesa_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('product-images','avatars','business-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "mesa_images_update" on storage.objects;
create policy "mesa_images_update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('product-images','avatars','business-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('product-images','avatars','business-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "mesa_images_delete" on storage.objects;
create policy "mesa_images_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('product-images','avatars','business-logos')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- OPCIONAL — si algún día quieres buckets públicos (las fotos cargan
-- un poco más rápido, pero cualquiera con el link puede verlas):
--
--   update storage.buckets set public = true
--    where id in ('product-images','avatars','business-logos');
--
-- y en assets/js/config.js pon  PUBLIC_BUCKETS: true
-- Las políticas de escritura de arriba siguen protegiendo el borrado
-- y la subida: solo el dueño puede tocar su carpeta.
-- =====================================================================
