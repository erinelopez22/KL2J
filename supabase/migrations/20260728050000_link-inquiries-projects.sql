-- Remove the "Ongoing" inquiry status (Kanban column removed), link projects
-- to the inquiry they originated from, and auto-sync inquiry status when the
-- linked project's status changes.

UPDATE public.inquiries SET status = 'Attended' WHERE status = 'Ongoing';
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_status_check
  CHECK (status IN ('New', 'Attended', 'Completed', 'Cancelled', 'Rejected'));

ALTER TABLE public.projects
  ADD COLUMN inquiry_id uuid REFERENCES public.inquiries(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.sync_inquiry_status_from_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.inquiry_id IS NOT NULL THEN
    IF NEW.status IN ('Attended', 'On-hold') THEN
      UPDATE public.inquiries SET status = 'Attended' WHERE id = NEW.inquiry_id;
    ELSIF NEW.status = 'Completed' THEN
      UPDATE public.inquiries SET status = 'Completed' WHERE id = NEW.inquiry_id;
    ELSIF NEW.status = 'Cancelled' THEN
      UPDATE public.inquiries SET status = 'Cancelled' WHERE id = NEW.inquiry_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_inquiry_status ON public.projects;
CREATE TRIGGER trg_sync_inquiry_status
  AFTER INSERT OR UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.sync_inquiry_status_from_project();
