-- ========================================================
-- ADD FIRST LANGUAGE COLUMN TO STUDENTS TABLE
-- ========================================================

-- Safe addition of the column using DO block
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'students' AND column_name = 'first_language'
    ) THEN
        ALTER TABLE public.students 
        ADD COLUMN first_language text DEFAULT 'Malayalam';
    END IF;
END $$;
