-- profile_photos.sql
-- Required profile photo upload + mutual visibility for matched users.
--
-- WHAT THIS DOES
--   1. Adds profiles.photo_path (the storage object path, e.g. "<user_id>/avatar.jpg").
--   2. Creates a PRIVATE Storage bucket 'profile-photos' (no public URLs).
--   3. Storage RLS so that:
--        - a user may upload/replace/delete only their OWN photo
--          (object path must live under their own "<auth.uid>/..." folder), and
--        - a user may READ another user's photo only while an admin-introduced
--          match between them is live ('pending' or 'matched') — i.e. the male
--          can see the female's photo as soon as the request is sent, and vice
--          versa. The admin dashboard reads via the service-role key, which
--          bypasses RLS, so admins always see every photo.
--
-- Idempotent: safe to re-run.

-- 1. Profile column ---------------------------------------------------------
alter table public.profiles
  add column if not exists photo_path text;

-- 2. Private bucket ---------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', false)
on conflict (id) do update set public = false;

-- 3. Storage policies -------------------------------------------------------
-- The owner's user id is the first path segment: "<user_id>/<filename>".

drop policy if exists "profile_photos_select_own_or_matched" on storage.objects;
create policy "profile_photos_select_own_or_matched"
on storage.objects for select
to authenticated
using (
  bucket_id = 'profile-photos'
  and (
    -- own photo
    (storage.foldername(name))[1] = (select auth.uid())::text
    -- or the photo of someone we have a live match with
    or exists (
      select 1
      from public.matches m
      where m.status in ('pending', 'matched')
        and (
          (m.male_user_id = (select auth.uid())
             and m.female_user_id::text = (storage.foldername(name))[1])
          or
          (m.female_user_id = (select auth.uid())
             and m.male_user_id::text = (storage.foldername(name))[1])
        )
    )
  )
);

drop policy if exists "profile_photos_insert_own" on storage.objects;
create policy "profile_photos_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "profile_photos_delete_own" on storage.objects;
create policy "profile_photos_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'profile-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
