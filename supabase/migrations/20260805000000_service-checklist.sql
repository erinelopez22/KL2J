-- Per-service, admin-customizable checklist of supporting documents (e.g.
-- "Has land title", "Tax declaration", "Has LRA documents"). Shown to the
-- inquirer once they pick that service (via the quote form or chatbot) so
-- they can indicate which they already have.
ALTER TABLE public.services ADD COLUMN checklist text[] NOT NULL DEFAULT '{}';

-- Snapshot of the checklist + what the inquirer checked at submission time
-- (kept as the full item list with a checked flag, not just checked-item
-- labels, so it stays meaningful even if the service's checklist changes
-- later).
ALTER TABLE public.inquiries ADD COLUMN checklist_responses jsonb NOT NULL DEFAULT '[]'::jsonb;
