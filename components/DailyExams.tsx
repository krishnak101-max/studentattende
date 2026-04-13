import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Student, BATCHES, DailyExam, DailyExamScore } from '../types';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  ClipboardCopy,
  Download,
  Save,
  Search,
  Trophy,
  TrendingUp,
  Users,
  PenTool,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

type ViewState = 'dashboard' | 'entry' | 'reports';

const DailyExams: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewState>('entry');
  const [loading, setLoading] = useState(false);

  // ENTRY STATE
  const [entryBatch, setEntryBatch] = useState<string>(BATCHES[0]);
  const [entryDate, setEntryDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [examCode, setExamCode] = useState<string>('');
  const [maxMarks, setMaxMarks] = useState<number>(50);
  const [students, setStudents] = useState<Student[]>([]);
  const [scoresData, setScoresData] = useState<Record<string, { score: number; is_absent: boolean }>>({});

  // REPORTS STATE
  const [reportStartDate, setReportStartDate] = useState(format(new Date(), 'yyyy-MM-01'));
  const [reportEndDate, setReportEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportBatch, setReportBatch] = useState<string>('All');
  const [reportExams, setReportExams] = useState<DailyExam[]>([]);
  const [reportScores, setReportScores] = useState<(DailyExamScore & { student: Student; daily_exams: DailyExam })[]>([]);

  // DASHBOARD STATE
  const [recentExams, setRecentExams] = useState<DailyExam[]>([]);
  const [topScorers, setTopScorers] = useState<any[]>([]);

  // FETCH STUDENTS FOR ENTRY
  useEffect(() => {
    if (activeView === 'entry') {
      fetchStudentsForEntry();
    }
  }, [entryBatch, activeView]);

  const fetchStudentsForEntry = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .eq('batch', entryBatch)
        .order('name', { ascending: true });

      if (error) throw error;
      setStudents(data || []);
      
      // Initialize scores
      const initial: Record<string, { score: number; is_absent: boolean }> = {};
      (data || []).forEach(s => {
        initial[s.id] = { score: 0, is_absent: false };
      });
      setScoresData(initial);
    } catch (err: any) {
      toast.error("Failed to load students: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // CHECK IF EXAM ALREADY EXISTS
  const checkExistingExamAndLoad = async () => {
    if (!examCode) return;
    try {
      setLoading(true);
      const { data: examData, error: examError } = await supabase
        .from('daily_exams')
        .select('*')
        .eq('exam_code', examCode.toUpperCase())
        .eq('batch', entryBatch)
        .eq('date', entryDate)
        .maybeSingle();

      if (examError) throw examError;

      if (examData) {
        setMaxMarks(examData.max_marks);
        const { data: scoreData, error: scoreError } = await supabase
          .from('daily_exam_scores')
          .select('*')
          .eq('exam_id', examData.id);

        if (scoreError) throw scoreError;

        if (scoreData) {
          const updatedScores = { ...scoresData };
          scoreData.forEach(s => {
            if (updatedScores[s.student_id]) {
              updatedScores[s.student_id] = { score: s.score, is_absent: s.is_absent };
            }
          });
          setScoresData(updatedScores);
          toast.success("Loaded existing exam data.");
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // HANDLE SCORE SAVE
  const handleSaveExam = async () => {
    if (!examCode.trim()) {
      toast.error("Please enter an Exam Code (e.g., DAT01)");
      return;
    }
    
    // Validate uppercase and number
    if (!/^[A-Z]+\d+$/.test(examCode)) {
      toast.error("Exam Code should be capital letters followed by numbers (e.g., DAT01)");
      return;
    }

    if (maxMarks <= 0) {
      toast.error("Max marks must be greater than 0");
      return;
    }

    try {
      setLoading(true);
      // 1. Create or update daily_exams
      let examId = '';
      const { data: existExam } = await supabase
        .from('daily_exams')
        .select('id')
        .eq('exam_code', examCode.toUpperCase())
        .eq('batch', entryBatch)
        .eq('date', entryDate)
        .maybeSingle();

      if (existExam) {
        examId = existExam.id;
        await supabase
          .from('daily_exams')
          .update({ max_marks: maxMarks })
          .eq('id', examId);
      } else {
        const { data: newExam, error: insertError } = await supabase
          .from('daily_exams')
          .insert({
            batch: entryBatch,
            date: entryDate,
            exam_code: examCode.toUpperCase(),
            max_marks: maxMarks
          })
          .select()
          .single();
        if (insertError) throw insertError;
        examId = newExam.id;
      }

      // 2. Insert or update scores
      const validStudentIds = students.map(s => s.id);
      
      const payload = validStudentIds.map(stId => ({
        exam_id: examId,
        student_id: stId,
        score: scoresData[stId].is_absent ? 0 : Number(scoresData[stId].score),
        is_absent: scoresData[stId].is_absent
      }));

      // Delete existing scores for this exam
      await supabase.from('daily_exam_scores').delete().eq('exam_id', examId);
      
      const { error: scoresError } = await supabase
        .from('daily_exam_scores')
        .insert(payload);

      if (scoresError) throw scoresError;

      toast.success("Exam scores saved successfully!");
      setExamCode('');
      fetchStudentsForEntry(); // Reset scores
      
    } catch (err: any) {
      toast.error("Failed to save exam: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // FETCH DASHBOARD / REPORTS DATA
  useEffect(() => {
    if (activeView === 'dashboard') {
      fetchDashboardData();
    } else if (activeView === 'reports') {
      fetchReportData();
    }
  }, [activeView, reportStartDate, reportEndDate, reportBatch]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // Get recent 5 exams
      const { data: exams, error: examsErr } = await supabase
        .from('daily_exams')
        .select('*')
        .order('date', { ascending: false })
        .limit(5);
      
      if (examsErr) throw examsErr;
      setRecentExams(exams || []);

      // Get top scorers globally for recent exams or all time (simple query: latest scores)
      // Since supabase JS joins can be tricky, let's fetch exams from past 7 days and their scores + students
      const { data: recentScores, error: rsErr } = await supabase
        .from('daily_exam_scores')
        .select(`
          score,
          is_absent,
          student_id,
          daily_exams!inner(*),
          students!inner(*)
        `)
        .eq('is_absent', false)
        .order('score', { ascending: false })
        .limit(10);
      
      if (rsErr) throw rsErr;
      
      // Transform
      const rankers = (recentScores || []).map((rs: any) => ({
        name: rs.students.name,
        batch: rs.students.batch,
        score: rs.score,
        date: rs.daily_exams.date,
        code: rs.daily_exams.exam_code,
        max: rs.daily_exams.max_marks
      }));

      // Group by batch to get top scorer per batch for dashboard
      const topPerBatch: Record<string, any> = {};
      rankers.forEach(r => {
        if (!topPerBatch[r.batch] || topPerBatch[r.batch].score < r.score) {
          topPerBatch[r.batch] = r;
        }
      });
      setTopScorers(Object.values(topPerBatch));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('daily_exam_scores')
        .select(`
          *,
          students!inner(*),
          daily_exams!inner(*)
        `)
        .gte('daily_exams.date', reportStartDate)
        .lte('daily_exams.date', reportEndDate)
        .order('score', { ascending: false });

      if (reportBatch !== 'All') {
        query = query.eq('students.batch', reportBatch);
      }

      const { data, error } = await query;
      if (error) throw error;

      setReportScores(data || []);

    } catch (err) {
      console.error(err);
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  // RENDER HELPERS
  const filteredReportList = reportScores
    .filter(rs => rs.daily_exams.date >= reportStartDate && rs.daily_exams.date <= reportEndDate);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("Daily Exam (DAT) Rank List", 14, 20);
    
    doc.setFontSize(12);
    doc.text(`Date Range: ${reportStartDate} to ${reportEndDate}`, 14, 30);
    doc.text(`Batch: ${reportBatch}`, 14, 38);

    const tableData = filteredReportList.map((rs, index) => [
      index + 1,
      rs.students.name,
      rs.students.batch,
      rs.daily_exams.exam_code,
      rs.daily_exams.date,
      rs.is_absent ? 'AB' : rs.score.toString(),
      rs.daily_exams.max_marks.toString()
    ]);

    (doc as any).autoTable({
      startY: 45,
      head: [['Rank', 'Student Name', 'Batch', 'Exam Code', 'Date', 'Score', 'Max']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`DAT_Report_${reportBatch}_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success("PDF Downloaded successfully!");
  };

  const copyRankList = () => {
    const textToCopy = filteredReportList.map((rs, index) => 
      `${index + 1}. ${rs.students.name} - ${rs.is_absent ? 'AB' : rs.score}/${rs.daily_exams.max_marks}`
    ).join('\n');

    navigator.clipboard.writeText(`DAT Rank List (${reportStartDate} to ${reportEndDate})\n\n` + textToCopy);
    toast.success("Rank list copied to clipboard!");
  };

  return (
    <div className="space-y-6">
      {/* HEADER & TABS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <PenTool className="h-6 w-6 text-primary" />
            Daily Examinations (DAT)
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage, enter scores, and generate rank lists</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveView('dashboard')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeView === 'dashboard' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          >
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </button>
          <button 
            onClick={() => setActiveView('entry')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeView === 'entry' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          >
            <PenTool className="h-4 w-4" /> Entry
          </button>
          <button 
            onClick={() => setActiveView('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${activeView === 'reports' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
          >
            <FileBarChart className="h-4 w-4" /> Reports
          </button>
        </div>
      </div>

      {/* DASHBOARD VIEW */}
      {activeView === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top Scorers Widget */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Batch Top Scorers
              </h2>
            </div>
            <div className="p-4">
              {topScorers.length > 0 ? (
                <div className="space-y-4">
                  {topScorers.map((ts, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">
                          {ts.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{ts.name}</p>
                          <p className="text-xs text-slate-500">Batch {ts.batch} • {ts.code}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{ts.score} <span className="text-xs text-slate-400">/ {ts.max}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-4">No recent exams found.</p>
              )}
            </div>
          </div>

          {/* Recent Exams Widget */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-white">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <History className="h-5 w-5 text-indigo-500" />
                Recent Exams
              </h2>
            </div>
            <div className="p-4">
              {recentExams.length > 0 ? (
                <div className="space-y-3">
                  {recentExams.map((ex, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                      <div>
                        <p className="font-bold text-slate-700">{ex.exam_code}</p>
                        <p className="text-xs text-slate-500">Batch {ex.batch} • {ex.date}</p>
                      </div>
                      <div className="text-sm font-semibold bg-slate-100 px-3 py-1 rounded-lg">
                        Max {ex.max_marks}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm text-center py-4">No exams recorded yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ENTRY VIEW */}
      {activeView === 'entry' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Batch</label>
              <select
                className="w-full border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                value={entryBatch}
                onChange={(e) => setEntryBatch(e.target.value)}
              >
                {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Exam Date</label>
              <input
                type="date"
                className="w-full border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Exam Code</label>
              <input
                type="text"
                placeholder="e.g. DAT01"
                className="w-full border-slate-200 rounded-xl focus:ring-primary focus:border-primary uppercase"
                value={examCode}
                onChange={(e) => setExamCode(e.target.value.toUpperCase())}
                onBlur={checkExistingExamAndLoad}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Max Marks</label>
              <input
                type="number"
                min="1"
                className="w-full border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                value={maxMarks}
                onChange={(e) => setMaxMarks(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleSaveExam}
                disabled={loading || !examCode || students.length === 0}
                className="w-full bg-primary hover:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:bg-slate-300"
              >
                <Save className="h-5 w-5" />
                {loading ? 'Saving...' : 'Save Scores'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-y border-slate-200 text-slate-600">
                  <th className="p-3 font-semibold text-sm w-16">No.</th>
                  <th className="p-3 font-semibold text-sm">Student Name</th>
                  <th className="p-3 font-semibold text-sm text-center w-32">Status</th>
                  <th className="p-3 font-semibold text-sm text-center w-32">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-800">{student.name}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => {
                          setScoresData(prev => ({
                            ...prev,
                            [student.id]: {
                              ...prev[student.id],
                              is_absent: !prev[student.id].is_absent,
                              score: prev[student.id].is_absent ? prev[student.id].score : 0, // Reset to 0 if making absent
                            }
                          }));
                        }}
                        className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${
                          scoresData[student.id]?.is_absent
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                        }`}
                      >
                        {scoresData[student.id]?.is_absent ? 'ABSENT' : 'PRESENT'}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max={maxMarks}
                        disabled={scoresData[student.id]?.is_absent}
                        className={`w-20 text-center border-slate-200 rounded-lg p-1.5 focus:ring-primary focus:border-primary transition-opacity ${
                          scoresData[student.id]?.is_absent ? 'opacity-50 bg-slate-100' : ''
                        }`}
                        value={scoresData[student.id]?.score === 0 ? '' : scoresData[student.id]?.score}
                        onChange={(e) => {
                          let val = Number(e.target.value);
                          if (val > maxMarks) val = maxMarks; // auto cap at maxmarks
                          if (val < 0) val = 0;
                          
                          setScoresData(prev => ({
                            ...prev,
                            [student.id]: {
                              ...prev[student.id],
                              score: val
                            }
                          }));
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {students.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No students found in this batch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORTS VIEW */}
      {activeView === 'reports' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
              <input
                type="date"
                className="w-full border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                value={reportStartDate}
                onChange={(e) => setReportStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
              <input
                type="date"
                className="w-full border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                value={reportEndDate}
                onChange={(e) => setReportEndDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Batch Filter</label>
              <select
                className="w-full border-slate-200 rounded-xl focus:ring-primary focus:border-primary"
                value={reportBatch}
                onChange={(e) => setReportBatch(e.target.value)}
              >
                <option value="All">All Batches</option>
                {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={generatePDF}
                disabled={filteredReportList.length === 0}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 border border-red-200 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> PDF
              </button>
              <button
                onClick={copyRankList}
                disabled={filteredReportList.length === 0}
                className="flex-1 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ClipboardCopy className="h-4 w-4" /> Copy
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-left">
              <thead className="bg-gradient-to-r from-blue-50 to-indigo-50">
                <tr className="text-slate-700">
                  <th className="p-3 font-semibold w-16 text-center">Rank</th>
                  <th className="p-3 font-semibold">Student Name</th>
                  <th className="p-3 font-semibold">Batch</th>
                  <th className="p-3 font-semibold">Exam Code</th>
                  <th className="p-3 font-semibold">Date</th>
                  <th className="p-3 font-semibold text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredReportList.length > 0 ? (
                  filteredReportList.map((rs, idx) => (
                    <tr key={idx} className={`hover:bg-slate-50 ${idx < 3 ? 'bg-yellow-50/30' : ''}`}>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'text-slate-500'}`}>
                          {idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-800">{rs.students.name}</td>
                      <td className="p-3 text-slate-600">{rs.students.batch}</td>
                      <td className="p-3 font-medium text-primary">{rs.daily_exams.exam_code}</td>
                      <td className="p-3 text-slate-500">{rs.daily_exams.date}</td>
                      <td className="p-3 text-right">
                        {rs.is_absent ? (
                          <span className="text-red-500 font-bold bg-red-50 px-2 py-1 rounded">AB</span>
                        ) : (
                          <span className="font-bold text-slate-800">{rs.score} <span className="text-slate-400 font-normal text-xs">/ {rs.daily_exams.max_marks}</span></span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
                      <AlertCircle className="h-5 w-5" /> No records found for this criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyExams;
