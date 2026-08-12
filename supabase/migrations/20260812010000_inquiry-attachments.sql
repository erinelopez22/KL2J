-- Consolidated view of every file exchanged on an inquiry (from its
-- checklist document answers plus every comment attachment, by either
-- side), so admins and the inquirer can see "all files" in one place
-- without digging through the comment thread.
ALTER TABLE public.inquiries ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]';
