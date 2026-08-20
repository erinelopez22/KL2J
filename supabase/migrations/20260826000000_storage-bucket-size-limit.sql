-- Admin uploads now go directly from the browser to Supabase Storage via a
-- signed upload URL, so the app server can only validate the client-
-- reported file size/type at mint time, not the actual bytes written. Add
-- a bucket-level ceiling as a hard backstop matching the app's 50MB cap.
UPDATE storage.buckets SET file_size_limit = 52428800 WHERE id IN ('site-media', 'confidential-media');
