-- ========================================================
-- ALUMNI AND TRANSFER SYSTEM - DATABASE SETUP
-- ========================================================

-- 1. Ensure the ALUMNI batch exists in the batches table
INSERT INTO public.batches (name, is_active)
SELECT 'ALUMNI', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.batches WHERE name = 'ALUMNI'
);

-- 2. BULK TRANSFER FUNCTION
-- Moves all students from one batch name to another
CREATE OR REPLACE FUNCTION transfer_students(
  from_batch text,
  to_batch text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.students
  SET batch = to_batch
  WHERE batch = from_batch;
END;
$$;

-- 3. INDIVIDUAL TRANSFER FUNCTION
-- Moves a specific student by ID to a new batch
CREATE OR REPLACE FUNCTION transfer_single_student(
  target_student_id uuid,
  to_batch text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.students
  SET batch = to_batch
  WHERE id = target_student_id;
END;
$$;

-- 4. Set proper permissions (Allow authenticated users to call these)
REVOKE ALL ON FUNCTION transfer_students(text, text) FROM public;
GRANT EXECUTE ON FUNCTION transfer_students(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_students(text, text) TO service_role;

REVOKE ALL ON FUNCTION transfer_single_student(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION transfer_single_student(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_single_student(uuid, text) TO service_role;
