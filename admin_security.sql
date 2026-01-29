-- ==========================================
-- SECURE ADMIN FUNCTIONS (PASSWORD PROTECTED)
-- ==========================================
-- Run this in your Supabase SQL Editor to secure your app.
-- Password set to: wings2026

-- 1. Secure Clear Attendance
-- Drops the old function (if it exists with 0 args) and creates a new one requiring a password.
DROP FUNCTION IF EXISTS clear_all_attendance();

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

-- 2. Secure Full System Reset
DROP FUNCTION IF EXISTS reset_full_system();

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
