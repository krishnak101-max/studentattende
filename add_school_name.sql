-- Execute this SQL code in your Supabase SQL Editor to add the school_name column

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS school_name text DEFAULT 'GHSS Karakkunnu';

-- (Optional) If you want to update all existing students to have the default school name
UPDATE public.students 
SET school_name = 'GHSS Karakkunnu' 
WHERE school_name IS NULL;
