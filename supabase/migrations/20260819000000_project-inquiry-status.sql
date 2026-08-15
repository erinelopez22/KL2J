-- Public-facing "state" badge on a project, derived from its linked
-- inquiry's status. Kept in sync purely by triggers (no app code has to
-- remember to update it): setting/changing a project's inquiry_id pulls
-- the current status in, and changing the inquiry's status later pushes it
-- out to any project(s) linked to it. Never exposes anything else from
-- inquiries (name/email/phone/message) — those stay admin-only.

ALTER TABLE public.projects ADD COLUMN inquiry_status text;

UPDATE public.projects p
SET inquiry_status = i.status
FROM public.inquiries i
WHERE p.inquiry_id = i.id;

CREATE OR REPLACE FUNCTION public.set_project_inquiry_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.inquiry_id IS NOT NULL THEN
    SELECT status INTO NEW.inquiry_status FROM public.inquiries WHERE id = NEW.inquiry_id;
  ELSE
    NEW.inquiry_status := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_project_inquiry_status ON public.projects;
CREATE TRIGGER trg_set_project_inquiry_status
  BEFORE INSERT OR UPDATE OF inquiry_id ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_project_inquiry_status();

CREATE OR REPLACE FUNCTION public.propagate_inquiry_status_to_projects()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.projects SET inquiry_status = NEW.status WHERE inquiry_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_inquiry_status ON public.inquiries;
CREATE TRIGGER trg_propagate_inquiry_status
  AFTER UPDATE OF status ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.propagate_inquiry_status_to_projects();
