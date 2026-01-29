-- ==========================================
-- ABSENTEE ANALYSIS FUNCTIONS
-- ==========================================

-- Function to get student statistics optimized for Absentee Analysis
-- Returns: Basic info, Total Absence Count, and their status for the last 10 working days.

DROP FUNCTION IF EXISTS get_student_absentee_stats();

CREATE OR REPLACE FUNCTION get_student_absentee_stats()
RETURNS TABLE (
  id uuid,
  name text,
  batch text,
  roll_number text,
  total_absent bigint,
  last_10_statuses text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  recent_school_dates text[];
BEGIN
  -- 1. Identify the last 10 days where ANY attendance was recorded (School Days)
  SELECT ARRAY(
    SELECT DISTINCT date 
    FROM attendance 
    ORDER BY date DESC 
    LIMIT 10
  ) INTO recent_school_dates;

  -- 2. Return Data
  RETURN QUERY
  WITH student_history AS (
    SELECT 
      s.id as s_id,
      -- We gather statuses specifically for the identified school dates
      -- COALESCE is important: if no record exists for a date, we assume 'idk' or null, 
      -- but usually attendance is fully populated. We'll just grab what exists.
      ARRAY(
        SELECT a.status 
        FROM attendance a
        WHERE a.student_id = s.id 
        AND a.date = ANY(recent_school_dates)
        ORDER BY a.date DESC
      ) as status_arr
    FROM students s
  )
  SELECT 
    s.id,
    s.name,
    s.batch,
    s.roll_number,
    (SELECT count(*) FROM attendance a WHERE a.student_id = s.id AND a.status = 'Absent') as total_absent,
    h.status_arr
  FROM students s
  LEFT JOIN student_history h ON s.id = h.s_id;
END;
$$;
