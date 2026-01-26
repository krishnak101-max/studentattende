export interface Student {
  id: string;
  name: string;
  batch: string;
  sex: 'Male' | 'Female';
  roll_number?: string;
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