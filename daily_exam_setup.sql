-- Daily Exams Table
CREATE TABLE IF NOT EXISTS public.daily_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch TEXT NOT NULL,
    date DATE NOT NULL,
    exam_code TEXT NOT NULL,
    max_marks NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily Exam Scores Table
CREATE TABLE IF NOT EXISTS public.daily_exam_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES public.daily_exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    score NUMERIC DEFAULT 0,
    is_absent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(exam_id, student_id)
);

-- Enable RLS
ALTER TABLE public.daily_exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_exam_scores ENABLE ROW LEVEL SECURITY;

-- Create Policies for daily_exams
CREATE POLICY "Enable read access for all users on daily_exams"
    ON public.daily_exams FOR SELECT
    USING (true);

CREATE POLICY "Enable insert access for all users on daily_exams"
    ON public.daily_exams FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable update access for all users on daily_exams"
    ON public.daily_exams FOR UPDATE
    USING (true);

CREATE POLICY "Enable delete access for all users on daily_exams"
    ON public.daily_exams FOR DELETE
    USING (true);

-- Create Policies for daily_exam_scores
CREATE POLICY "Enable read access for all users on daily_exam_scores"
    ON public.daily_exam_scores FOR SELECT
    USING (true);

CREATE POLICY "Enable insert access for all users on daily_exam_scores"
    ON public.daily_exam_scores FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Enable update access for all users on daily_exam_scores"
    ON public.daily_exam_scores FOR UPDATE
    USING (true);

CREATE POLICY "Enable delete access for all users on daily_exam_scores"
    ON public.daily_exam_scores FOR DELETE
    USING (true);
