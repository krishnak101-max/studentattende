-- ==========================================
-- NEW FEATURES SETUP FOR WINGS COACHING APP
-- Run this in your Supabase SQL Editor
-- ==========================================
-- 1. Create batches table
CREATE TABLE IF NOT EXISTS public.batches (
    id uuid default gen_random_uuid() primary key,
    name text not null unique,
    is_active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Insert original batches
INSERT INTO public.batches (name, is_active)
VALUES ('S1', true),
    ('S2', true),
    ('S3', true),
    ('N1', true),
    ('N2', true),
    ('E1', true) ON CONFLICT (name) DO NOTHING;
-- 2. Modify Students Table to add new fields
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS medium text,
    ADD COLUMN IF NOT EXISTS parent_name text,
    ADD COLUMN IF NOT EXISTS phone_number text,
    ADD COLUMN IF NOT EXISTS register_number text;
-- 3. You can set the register number logic either manually through the dashboard
-- OR with this optional sequence approach if auto generating inside the DB:
-- CREATE SEQUENCE IF NOT EXISTS student_reg_seq START 1;
-- 
-- CREATE OR REPLACE FUNCTION generate_register_number()
-- RETURNS trigger AS $$
-- BEGIN
--   IF NEW.register_number IS NULL THEN
--     NEW.register_number := 'W26' || lpad(nextval('student_reg_seq')::text, 4, '0');
--   END IF;
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
-- 
-- DROP TRIGGER IF EXISTS set_register_number_trigger ON public.students;
-- CREATE TRIGGER set_register_number_trigger
-- BEFORE INSERT ON public.students
-- FOR EACH ROW EXECUTE FUNCTION generate_register_number();