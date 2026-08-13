-- Customer reviews/ratings shown on the public site (styled similar to a
-- Google Business review widget). Submissions are moderated: a new review
-- starts as 'pending' and only becomes visible to the public once an admin
-- approves it.

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT ALL ON public.reviews TO service_role;

CREATE POLICY "Public can read approved reviews" ON public.reviews
  FOR SELECT TO anon, authenticated
  USING (status = 'approved');

CREATE POLICY "Admins can read all reviews" ON public.reviews
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));

-- No anon/authenticated write policies: submitting a review and moderating
-- (approve/reject/delete) both go through service-role-backed server
-- functions, not direct client writes.
