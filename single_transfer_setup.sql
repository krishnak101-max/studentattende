-- ==========================================
-- SINGLE STUDENT TRANSFER FUNCTION
-- ==========================================

-- Function to transfer a single student by ID
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
