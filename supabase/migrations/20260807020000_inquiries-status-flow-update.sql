-- Inquiry status is now set manually by dragging cards between columns on
-- the admin Kanban board. Rename the workflow: "Attended" -> "Ongoing",
-- and add "Onhold".

UPDATE public.inquiries SET status = 'Ongoing' WHERE status = 'Attended';

ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_status_check;
ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_status_check
  CHECK (status IN ('New', 'Ongoing', 'Onhold', 'Completed', 'Rejected', 'Cancelled'));
