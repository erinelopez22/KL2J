ALTER TABLE public.inquiries
  ADD COLUMN email_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN email_error text;
