import { createClient } from '@supabase/supabase-js';

// Credentials provided in instructions
// Ideally, these should come from import.meta.env for Vercel deployment
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://qvzzlpcbeauppwhyixli.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2enpscGNiZWF1cHB3aHlpeGxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDA3MjksImV4cCI6MjA4NDkxNjcyOX0.4pwfm9AwsvswJD8pOPn-5S2jylVyRj8euMlBmIAt380';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*
=========================================================
1. SQL TO CREATE TABLES (If not done yet)
=========================================================
create table public.students (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  batch text not null,
  sex text not null,
  roll_number text, 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students(id) on delete cascade not null,
  date text not null,
  status text not null,
  unique(student_id, date)
);

=========================================================
2. SQL FOR ADMIN TOOLS (Run this to make Reset buttons work)
=========================================================

-- Function to clear ONLY attendance
create or replace function clear_all_attendance()
returns void
language plpgsql
security definer
as $$
begin
  truncate table public.attendance;
end;
$$;

-- Function to Reset Everything (Students + Attendance)
create or replace function reset_full_system()
returns void
language plpgsql
security definer
as $$
begin
  truncate table public.attendance;
  truncate table public.students cascade;
end;
$$;

=========================================================
3. SQL TO FIX '00' ROLL NUMBERS
=========================================================
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