-- Widen the posts.type check constraint to add seven more announcement
-- categories alongside the original project/service/profile/update.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_type_check;
ALTER TABLE public.posts ADD CONSTRAINT posts_type_check CHECK (
  type IN (
    'project', 'service', 'profile', 'update',
    'promotion', 'testimonial', 'credentials', 'team', 'event', 'deadline', 'partnership'
  )
);
