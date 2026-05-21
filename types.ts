export interface Student {
  id: string;
  name: string;
  batch: string;
  sex: string; // 'Male' | 'Female'
  medium?: string; // 'English' | 'Malayalam'
  parent_name?: string;
  phone_number?: string;
  register_number?: string;
  roll_number?: string;
  first_language?: string;
  school_name?: string;
  created_at?: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  date: string;
  status: 'Present' | 'Absent';
}

export interface AttendanceRecord extends Student {
  status: 'Present' | 'Absent';
  attendanceId?: string;
}

export const BATCHES = ['S1', 'S2', 'S3', 'N1', 'N2', 'E1'];

export interface StudentStats {
  present: number;
  absent: number;
  details: { date: string; status: string }[];
}

export interface Exam {
  id: string;
  title: string;
  subject?: string;
  batch: string;
  exam_date: string;
  max_marks: number;
  created_at?: string;
}

export interface ExamScore {
  id: string;
  exam_id: string;
  student_id: string;
  score: number | null;
  is_absent: boolean;
  created_at?: string;
  student?: Student;
  exam?: Exam;
}

export interface DailyExam {
  id: string;
  batch: string;
  date: string;
  exam_code: string;
  max_marks: number;
  created_at?: string;
}

export interface DailyExamScore {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
  is_absent: boolean;
  created_at?: string;
  student?: Student; // for joining
}