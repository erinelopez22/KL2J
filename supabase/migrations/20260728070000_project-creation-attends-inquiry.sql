-- When a project is first created for an inquiry, the inquiry should move to
-- "Attended" immediately (not just when the project's status later changes).
CREATE OR REPLACE FUNCTION public.sync_inquiry_status_from_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.inquiry_id IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.inquiries SET status = 'Attended' WHERE id = NEW.inquiry_id;
    ELSIF NEW.status IN ('Attended', 'On-hold') THEN
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
