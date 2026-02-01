-- ==============================================================================
-- WINGS COACHING CENTER - FULL DATABASE SCHEMA
-- ==============================================================================
-- Copy and paste this entire file into your Supabase SQL Editor.
-- It will create all necessary tables, functions, and security policies.

-- 1. CLEANUP (Optional: Only if you want to start fresh)
-- DROP TABLE IF EXISTS public.attendance CASCADE;
-- DROP TABLE IF EXISTS public.students CASCADE;

-- ==========================================
-- 2. CREATE TABLES
-- ==========================================

-- Table: Students
CREATE TABLE IF NOT EXISTS public.students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  batch text NOT NULL,
  sex text NOT NULL, -- 'Male' or 'Female'
  roll_number text, 
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table: Attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  date text NOT NULL, -- Format: YYYY-MM-DD
  status text NOT NULL, -- 'Present' or 'Absent'
  UNIQUE(student_id, date)
);

-- Enable Row Level Security (RLS) - Optional but recommended
-- For this app, we currently allow anon access via the key, so we might need policies if RLS is on.
-- By default, if RLS is enabled, anon cannot read/write. 
-- For simplicity in this specific user request context (where specific policies weren't asked for), 
-- we will DISABLE RLS or Adding Policies to allow access.
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Allow anon read/write (since we are using the detailed anon key handling in the app)
CREATE POLICY "Enable access for all users" ON public.students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable access for all users" ON public.attendance FOR ALL USING (true) WITH CHECK (true);


-- ==========================================
-- 3. ADMIN FUNCTIONS (Password Protected)
-- ==========================================

-- Function to clear ONLY attendance
CREATE OR REPLACE FUNCTION clear_all_attendance(password_attempt text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify Password
  IF password_attempt != 'wings2026' THEN
    RAISE EXCEPTION 'Access Denied: Invalid Admin Password';
  END IF;

  -- Execute Action
  TRUNCATE TABLE public.attendance;
END;
$$;

-- Function to Reset Everything (Students + Attendance)
CREATE OR REPLACE FUNCTION reset_full_system(password_attempt text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify Password
  IF password_attempt != 'wings2026' THEN
    RAISE EXCEPTION 'Access Denied: Invalid Admin Password';
  END IF;

  -- Execute Action
  TRUNCATE TABLE public.attendance;
  TRUNCATE TABLE public.students CASCADE;
END;
$$;


-- ==========================================
-- 4. ABSENTEE ANALYSIS FUNCTIONS
-- ==========================================

-- Function to get student statistics optimized for Absentee Analysis
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
  -- 1. Identify the last 10 days where ANY attendance was recorded
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

-- ==========================================
-- 5. UTILITY: Fix Roll Numbers
-- ==========================================
-- You can run this manually if roll numbers get out of sync or show '00'
/*
WITH sorted_rows AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (PARTITION BY batch ORDER BY CASE WHEN sex = 'Female' THEN 1 ELSE 2 END, name ASC) as new_rn
  FROM public.students
)
UPDATE public.students
SET roll_number = sorted_rows.new_rn
FROM sorted_rows
WHERE public.students.id = sorted_rows.id;
*/
