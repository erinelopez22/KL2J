-- Every checklist question was required by default; switch that off for
-- all existing services so nothing blocks an inquiry submission until an
-- admin deliberately marks a specific question required again — except
-- "Location of Lot", which stays required since every service needs it.
UPDATE public.services
SET checklist = (
  SELECT jsonb_agg(
    item || jsonb_build_object('required', lower(trim(item->>'label')) = 'location of lot')
  )
  FROM jsonb_array_elements(checklist) AS item
)
WHERE jsonb_array_length(checklist) > 0;
