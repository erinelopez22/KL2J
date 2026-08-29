-- The "Admins can read all gallery_folders/gallery_photos" policies added
-- in 20260829000000 applied to an admin's authenticated session
-- everywhere — including when that same logged-in browser views the
-- PUBLIC site (index.tsx queries gallery_folders/gallery_photos with the
-- plain client too), so a folder an admin toggled "hidden" would still
-- show up for them on the public page itself. RLS can't distinguish "this
-- is the admin panel" from "this is someone previewing the public page in
-- another tab" — only the authenticated role, which is the same either
-- way.
--
-- Fix: admin views now fetch through listAllGalleryFolders/
-- listAllGalleryPhotos (src/lib/admin/gallery.functions.ts), which use
-- the service role and bypass RLS entirely — so this blanket policy is no
-- longer needed, and removing it means is_public is the ONLY thing that
-- decides visibility for any direct client-side query, regardless of who
-- happens to be logged in.
DROP POLICY IF EXISTS "Admins can read all gallery_folders" ON public.gallery_folders;
DROP POLICY IF EXISTS "Admins can read all gallery_photos" ON public.gallery_photos;
