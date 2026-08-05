-- Upgrade services.checklist from a flat list of yes/no labels to a list of
-- typed items: { id, label, type, unit? } where type is one of
-- "text" | "number" | "location" | "checkbox" | "document". This lets a
-- checklist item ask for an actual answer (location, area in sqm, a free
-- text note) or an optional document upload, not just a yes/no tick.
ALTER TABLE public.services
  ALTER COLUMN checklist DROP DEFAULT,
  ALTER COLUMN checklist TYPE jsonb USING '[]'::jsonb,
  ALTER COLUMN checklist SET DEFAULT '[]'::jsonb;

-- Seed the real checklist content per service.
UPDATE public.services SET checklist = '[
  {"id": "location", "label": "Location of Lot", "type": "location"},
  {"id": "titled", "label": "Is it Titled?", "type": "checkbox"},
  {"id": "title_doc", "label": "Upload copy of Title / DOAS / approved LRA-DENR plan (Optional)", "type": "document"},
  {"id": "area", "label": "Area", "type": "number", "unit": "sqm"}
]'::jsonb
WHERE title = 'Relocation Survey';

UPDATE public.services SET checklist = '[
  {"id": "location", "label": "Location of Lot", "type": "location"},
  {"id": "total_area", "label": "Total Area of Lot", "type": "number", "unit": "sqm"},
  {"id": "num_lots", "label": "Number of Lots to subdivide into", "type": "number"},
  {"id": "title_doc", "label": "Upload copy of Title and Approved Plan (Optional)", "type": "document"},
  {"id": "scheme", "label": "Desired scheme (Optional)", "type": "text"}
]'::jsonb
WHERE title = 'Subdivision Survey';

UPDATE public.services SET checklist = '[
  {"id": "location", "label": "Location of Lot", "type": "location"},
  {"id": "num_lots", "label": "How many Lots to be consolidated", "type": "number"},
  {"id": "areas", "label": "Corresponding areas of lots", "type": "number", "unit": "sqm"},
  {"id": "title_doc", "label": "Upload copies of Title and Approved Plan (Optional)", "type": "document"}
]'::jsonb
WHERE title = 'Consolidation Survey';

UPDATE public.services SET checklist = '[
  {"id": "location", "label": "Location of Lot", "type": "location"},
  {"id": "area", "label": "Area to be surveyed", "type": "number", "unit": "sqm"},
  {"id": "title_doc", "label": "Upload copy of title (Optional)", "type": "document"}
]'::jsonb
WHERE title = 'Topographic Survey';

UPDATE public.services SET checklist = '[
  {"id": "location", "label": "Location of Lot", "type": "location"},
  {"id": "num_lots_consolidate", "label": "How many Lots to be consolidated", "type": "number"},
  {"id": "total_area", "label": "Total Area of Lots", "type": "number", "unit": "sqm"},
  {"id": "num_lots_subdivide", "label": "Number of Lots to subdivide into", "type": "number"},
  {"id": "title_doc", "label": "Upload copy of Title and Approved Plan (Optional)", "type": "document"}
]'::jsonb
WHERE title = 'Consolidation-Subdivision Survey';

UPDATE public.services SET checklist = '[
  {"id": "location", "label": "Location of Lot", "type": "location"}
]'::jsonb
WHERE title = 'Verification Survey';

UPDATE public.services SET checklist = '[
  {"id": "location", "label": "Location of Lot", "type": "location"},
  {"id": "area", "label": "Area to be surveyed", "type": "number", "unit": "sqm"},
  {"id": "title_doc", "label": "Upload copy of Title (Optional)", "type": "document"},
  {"id": "purpose", "label": "Purpose / notes for the As-built Survey", "type": "text"}
]'::jsonb
WHERE title = 'As-Built Survey';

UPDATE public.services SET checklist = '[]'::jsonb
WHERE title = 'Land Titling Assistance';
