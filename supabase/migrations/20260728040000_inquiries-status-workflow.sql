-- Inquiries: formalize a status workflow for the admin Kanban board.

UPDATE public.inquiries SET status = 'New' WHERE status IN ('new', 'handoff');
UPDATE public.inquiries SET status = 'Completed' WHERE status = 'resolved';
UPDATE public.inquiries SET status = 'New' WHERE status NOT IN ('New', 'Attended', 'Ongoing', 'Completed', 'Cancelled', 'Rejected');

ALTER TABLE public.inquiries ALTER COLUMN status SET DEFAULT 'New';
ALTER TABLE public.inquiries
  ADD CONSTRAINT inquiries_status_check
  CHECK (status IN ('New', 'Attended', 'Ongoing', 'Completed', 'Cancelled', 'Rejected'));
