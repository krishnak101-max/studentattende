-- ==========================================
-- ALUMNI AND TRANSFER SYSTEM
-- ==========================================

-- 1. Create ALUMNI batch if it doesn't exist
INSERT INTO public.batches (name, is_active)
SELECT 'ALUMNI', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.batches WHERE name = 'ALUMNI'
);

-- 2. Function to transfer students between batches
CREATE OR REPLACE FUNCTION transfer_students(
  from_batch text,
  to_batch text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Simple update of student records
  UPDATE public.students
  SET batch = to_batch
  WHERE batch = from_batch;
END;
$$;
