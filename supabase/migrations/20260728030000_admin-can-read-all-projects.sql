-- The "Completed only" read policy on projects was accidentally also blocking
-- admins from seeing their own draft/in-progress projects in /admin, since it
-- applied to both anon and authenticated. Add a second policy so anyone with
-- the admin or super_admin role can see every project regardless of status.
-- (RLS policies are OR'd together, so public visitors still only see Completed.)

CREATE POLICY "Admins can read all projects" ON public.projects
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'));
