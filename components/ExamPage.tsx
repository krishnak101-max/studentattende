import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Student, Exam } from '../types';
import { useBatches } from '../context/BatchContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {
  BookOpen, Plus, Save, Trash2, Trophy, ClipboardList,
  ChevronDown, AlertCircle, CheckCircle2, XCircle,
  Download, Lock, Unlock, Calendar, Hash,
  BarChart2, Award, Edit3, RefreshCw
} from 'lucide-react';

type TabType = 'entry' | 'manage' | 'results';

// ─── Grade System ─────────────────────────────────────────────────────────────
const GRADED_BATCHES = ['S1', 'S2', 'S3', 'N1', 'N2'];

const getGrade = (percentage: number, batch?: string) => {
  // E1, E2 and others: no grade yet
  if (batch && !GRADED_BATCHES.includes(batch)) {
    return { label: '—', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
  if (percentage >= 90) return { label: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' };
  if (percentage >= 80) return { label: 'A',  color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-300'   };
  if (percentage >= 70) return { label: 'B+', color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-300'    };
  if (percentage >= 60) return { label: 'B',  color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-300'    };
  if (percentage >= 50) return { label: 'C+', color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-300'  };
  if (percentage >= 40) return { label: 'C',  color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-300'  };
  if (percentage >= 30) return { label: 'D+', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-300'  };
  if (percentage > 0)   return { label: 'D',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-300'     };
  return                       { label: 'E',  color: 'text-red-900',     bg: 'bg-red-100',    border: 'border-red-400'     };
};

const getGradeLabel = (percentage: number, batch?: string): string => {
  if (batch && !GRADED_BATCHES.includes(batch)) return '—';
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C+';
  if (percentage >= 40) return 'C';
  if (percentage >= 30) return 'D+';
  if (percentage > 0)   return 'D';
  return 'E';
};

const calcPct = (score: number | null, max: number) =>
  score === null || max === 0 ? 0 : Math.round((score / max) * 100);

// ─── Main Component ───────────────────────────────────────────────────────────
const ExamPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('entry');

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'entry',   label: 'Mark Entry',    icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'manage',  label: 'Manage Exams',  icon: <Plus className="h-4 w-4" /> },
    { id: 'results', label: 'Results',       icon: <Trophy className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-200">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Exam Management</h1>
            <p className="text-indigo-200 text-sm mt-0.5">Create exams, enter marks &amp; view results</p>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-md'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-in fade-in duration-200">
        {activeTab === 'entry'   && <MarkEntryTab />}
        {activeTab === 'manage'  && <ManageExamsTab />}
        {activeTab === 'results' && <ResultsTab />}
      </div>
    </div>
  );
};

// ─── Mark Entry Tab ───────────────────────────────────────────────────────────
const MarkEntryTab: React.FC = () => {
  const { activeBatches } = useBatches();
  const [batch, setBatch] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [scores, setScores] = useState<Record<string, { score: string; is_absent: boolean }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasExistingScores, setHasExistingScores] = useState(false);

  useEffect(() => {
    if (activeBatches.length > 0 && !batch) setBatch(activeBatches[0].name);
  }, [activeBatches]);

  useEffect(() => {
    if (!batch) return;
    const fetchExams = async () => {
      const { data } = await supabase
        .from('exams').select('*').eq('batch', batch)
        .order('exam_date', { ascending: false });
      setExams(data || []);
      setSelectedExam(null);
      setStudents([]);
      setScores({});
      setHasExistingScores(false);
    };
    fetchExams();
  }, [batch]);

  useEffect(() => {
    if (!selectedExam) return;
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: studs }, { data: existScores }, { data: globalAtt }] = await Promise.all([
          supabase.from('students').select('*')
            .eq('batch', selectedExam.batch)
            .neq('batch', 'ALUMNI')
            .order('roll_number', { ascending: true }),
          supabase.from('exam_scores').select('*').eq('exam_id', selectedExam.id),
          supabase.from('attendance').select('student_id, status').eq('date', selectedExam.exam_date),
        ]);

        const studsData = studs || [];
        setStudents(studsData);

        const existing = existScores || [];
        setHasExistingScores(existing.length > 0);
        const globalAttData = globalAtt || [];

        const scoreMap: Record<string, { score: string; is_absent: boolean }> = {};
        studsData.forEach(s => {
          const ex = existing.find(e => e.student_id === s.id);
          const att = globalAttData.find(a => a.student_id === s.id);
          const is_absent = att ? att.status === 'Absent' : false;
          
          scoreMap[s.id] = {
            score: ex && ex.score !== null ? String(ex.score) : '',
            is_absent
          };
        });
        setScores(scoreMap);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedExam]);

  const presentCount = Object.values(scores).filter(s => !s.is_absent).length;
  const absentCount  = Object.values(scores).filter(s => s.is_absent).length;

  const handleSave = async () => {
    if (!selectedExam) return;
    setSaving(true);
    try {
      const payload = students.map(s => ({
        exam_id: selectedExam.id,
        student_id: s.id,
        score: scores[s.id]?.is_absent ? null : (scores[s.id]?.score === '' ? null : Number(scores[s.id]?.score)),
        is_absent: scores[s.id]?.is_absent || false,
      }));
      const { error } = await supabase
        .from('exam_scores')
        .upsert(payload, { onConflict: 'exam_id,student_id' });
      if (error) throw error;
      toast.success(hasExistingScores ? '✅ Marks updated successfully!' : '✅ Marks saved successfully!');
      setHasExistingScores(true);
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Batch</label>
            <div className="relative">
              <select
                value={batch}
                onChange={e => setBatch(e.target.value)}
                className="w-full pl-4 pr-8 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-semibold appearance-none"
              >
                {activeBatches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Select Exam</label>
            <div className="relative">
              <select
                value={selectedExam?.id || ''}
                onChange={e => {
                  const found = exams.find(ex => ex.id === e.target.value) || null;
                  setSelectedExam(found);
                }}
                className="w-full pl-4 pr-8 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-semibold appearance-none"
              >
                <option value="">— Select an exam —</option>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}{ex.subject ? ` (${ex.subject})` : ''} · {ex.exam_date} · Max {ex.max_marks}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
            {exams.length === 0 && batch && (
              <p className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> No exams for batch {batch}. Create one in "Manage Exams".
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Exam Info Banner */}
      {selectedExam && (
        <div className={`border rounded-2xl p-4 flex flex-wrap items-center gap-6 ${
          hasExistingScores
            ? 'bg-amber-50 border-amber-200'
            : 'bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-100'
        }`}>
          <div className="flex items-center gap-2">
            {hasExistingScores
              ? <Edit3 className="h-4 w-4 text-amber-600" />
              : <BookOpen className="h-4 w-4 text-indigo-500" />
            }
            <span className="font-black text-slate-800">{selectedExam.title}</span>
            {selectedExam.subject && <span className="text-slate-500 text-sm">· {selectedExam.subject}</span>}
            {hasExistingScores && (
              <span className="ml-2 bg-amber-200 text-amber-800 text-xs font-black px-2.5 py-1 rounded-full flex items-center gap-1">
                <Edit3 className="h-3 w-3" /> EDIT MODE — Scores loaded
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-indigo-400" />{selectedExam.exam_date}
          </div>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Hash className="h-4 w-4 text-indigo-400" />Max: <strong>{selectedExam.max_marks}</strong>
          </div>
          <div className="ml-auto flex gap-3">
            <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-bold px-3 py-1.5 rounded-full">
              <CheckCircle2 className="h-3 w-3" /> Present: {presentCount}
            </span>
            <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-3 py-1.5 rounded-full">
              <XCircle className="h-3 w-3" /> Absent: {absentCount}
            </span>
          </div>
        </div>
      )}

      {/* Student Table */}
      {selectedExam && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-400 font-medium animate-pulse">Loading students...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-16">Roll</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student Name</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-44">Score / {selectedExam.max_marks}</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-24">%</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-20">Grade</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {students.map((student, idx) => {
                      const s = scores[student.id] || { score: '', is_absent: false };
                      const numScore = s.score === '' ? null : Number(s.score);
                      const p = s.is_absent ? 0 : calcPct(numScore, selectedExam.max_marks);
                      const grade = getGrade(p, selectedExam.batch);

                      return (
                        <tr
                          key={student.id}
                          className={`transition-colors hover:bg-indigo-50/30 ${s.is_absent ? 'opacity-60 bg-red-50/30' : ''}`}
                        >
                          <td className="p-4 font-bold text-slate-400 text-sm">{student.roll_number || idx + 1}</td>
                          <td className="p-4">
                            <span className="font-semibold text-slate-800">{student.name}</span>
                            {student.sex && (
                              <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded ${student.sex === 'Female' ? 'bg-pink-100 text-pink-600' : 'bg-blue-100 text-blue-600'}`}>
                                {student.sex === 'Female' ? '♀' : '♂'}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <input
                              type="number"
                              min={0}
                              max={selectedExam.max_marks}
                              disabled={s.is_absent}
                              placeholder={s.is_absent ? "Absent" : "—"}
                              value={s.score}
                              onChange={e => {
                                let val = e.target.value;
                                if (Number(val) > selectedExam.max_marks) val = String(selectedExam.max_marks);
                                if (Number(val) < 0) val = '0';
                                setScores(prev => ({ ...prev, [student.id]: { ...prev[student.id], score: val } }));
                              }}
                              className={`w-24 text-center py-2 px-3 rounded-xl border-2 font-bold text-lg outline-none transition-all ${
                                s.is_absent
                                  ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'
                                  : 'border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white'
                              }`}
                            />
                          </td>
                          <td className="p-4 text-center">
                            {!s.is_absent && numScore !== null ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-black text-slate-700 text-sm">{p}%</span>
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${p >= 75 ? 'bg-green-500' : p >= 45 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${p}%` }}
                                  />
                                </div>
                              </div>
                            ) : <span className="text-slate-300 text-sm">—</span>}
                          </td>
                          <td className="p-4 text-center">
                            {!s.is_absent && numScore !== null ? (
                              <span className={`inline-block px-2 py-1 rounded-lg text-xs font-black border ${grade.bg} ${grade.color} ${grade.border}`}>
                                {grade.label}
                              </span>
                            ) : s.is_absent ? (
                              <span className="text-red-400 font-bold text-xs">AB</span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <div>
                  {hasExistingScores && (
                    <p className="text-amber-600 text-sm font-bold flex items-center gap-1.5">
                      <RefreshCw className="h-4 w-4" /> Editing existing scores — changes will overwrite previous marks
                    </p>
                  )}
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`flex items-center gap-2 px-8 py-3 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-60 disabled:shadow-none ${
                    hasExistingScores
                      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {hasExistingScores ? <RefreshCw className="h-5 w-5" /> : <Save className="h-5 w-5" />}
                  {saving ? 'Saving...' : hasExistingScores ? 'Update Marks' : 'Save All Marks'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!selectedExam && !loading && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <ClipboardList className="h-12 w-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Select a batch and exam above to enter or edit marks</p>
        </div>
      )}
    </div>
  );
};

// ─── Manage Exams Tab ─────────────────────────────────────────────────────────
const ManageExamsTab: React.FC = () => {
  const { activeBatches } = useBatches();
  const [isAuth, setIsAuth] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [examDate, setExamDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [maxMarks, setMaxMarks] = useState('100');
  const [creating, setCreating] = useState(false);

  const fetchExams = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('exams').select('*').order('exam_date', { ascending: false });
    setExams(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuth) fetchExams();
  }, [isAuth, fetchExams]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === 'wings2026') {
      setIsAuth(true);
      toast.success('Admin unlocked');
    } else {
      toast.error('Wrong password');
      setPwInput('');
    }
  };

  const toggleBatch = (batchName: string) => {
    setSelectedBatches(prev =>
      prev.includes(batchName)
        ? prev.filter(b => b !== batchName)
        : [...prev, batchName]
    );
  };

  const selectAll = () => setSelectedBatches(activeBatches.map(b => b.name));
  const clearAll = () => setSelectedBatches([]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Exam title required'); return; }
    if (selectedBatches.length === 0) { toast.error('Select at least one batch'); return; }
    if (Number(maxMarks) <= 0) { toast.error('Max marks must be > 0'); return; }

    setCreating(true);
    try {
      // Create one exam record per selected batch
      const inserts = selectedBatches.map(b => ({
        title: title.trim(),
        subject: subject.trim() || null,
        batch: b,
        exam_date: examDate,
        max_marks: Number(maxMarks),
      }));

      const { error } = await supabase.from('exams').insert(inserts);
      if (error) throw error;
      toast.success(`✅ Exam created for ${selectedBatches.length} batch${selectedBatches.length > 1 ? 'es' : ''}!`);
      setTitle(''); setSubject(''); setMaxMarks('100'); setSelectedBatches([]);
      await fetchExams();
    } catch (err: any) {
      toast.error('Failed: ' + err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this exam and all its scores?')) return;
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) { toast.error('Delete failed'); return; }
    toast.success('Exam deleted');
    fetchExams();
  };

  if (!isAuth) {
    return (
      <div className="max-w-sm mx-auto mt-8">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center">
          <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="h-7 w-7 text-indigo-500" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-1">Admin Required</h2>
          <p className="text-slate-500 text-sm mb-6">Enter admin password to manage exams</p>
          <form onSubmit={handleUnlock} className="space-y-3">
            <input
              type="password"
              value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              placeholder="Admin Password"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 text-center tracking-widest text-lg"
              autoFocus
            />
            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              <Unlock className="h-4 w-4" /> Unlock
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2">
          <Plus className="h-5 w-5 text-indigo-500" /> Create New Exam
        </h2>
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Row 1: Title + Subject */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Exam Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. First Term Exam, Monthly Test 1"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Mathematics, Science, English"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-semibold"
              />
            </div>
          </div>

          {/* Row 2: Batch multi-select */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Select Batches * <span className="text-indigo-600 font-black">({selectedBatches.length} selected)</span>
              </label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-indigo-600 font-bold hover:underline">Select All</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={clearAll} className="text-xs text-slate-500 font-bold hover:underline">Clear</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 p-3 border border-slate-200 rounded-xl bg-slate-50 min-h-[52px]">
              {activeBatches.map(b => {
                const isSelected = selectedBatches.includes(b.name);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => toggleBatch(b.name)}
                    className={`px-4 py-2 rounded-xl text-sm font-black border-2 transition-all duration-150 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                  >
                    {isSelected && '✓ '}{b.name}
                  </button>
                );
              })}
              {activeBatches.length === 0 && <p className="text-slate-400 text-sm italic">No batches available</p>}
            </div>
            {selectedBatches.length === 0 && (
              <p className="mt-1.5 text-xs text-red-500 font-medium">Please select at least one batch</p>
            )}
          </div>

          {/* Row 3: Date + Max Marks + Button */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Exam Date *</label>
              <input
                type="date"
                value={examDate}
                onChange={e => setExamDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-semibold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Max Marks *</label>
              <input
                type="number"
                min={1}
                value={maxMarks}
                onChange={e => setMaxMarks(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 font-semibold"
                required
              />
            </div>
            <button
              type="submit"
              disabled={creating || selectedBatches.length === 0}
              className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all disabled:opacity-60 disabled:shadow-none"
            >
              <Plus className="h-5 w-5" />
              {creating ? 'Creating...' : `Create for ${selectedBatches.length || '?'} Batch${selectedBatches.length !== 1 ? 'es' : ''}`}
            </button>
          </div>
        </form>
      </div>

      {/* Grade Scale Reference */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="text-sm font-black text-slate-700 mb-3 uppercase tracking-wider">Grade Scale Reference</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-indigo-600 mb-2 uppercase tracking-widest">S1, S2, S3, N1, N2</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { g: 'A+', r: '≥ 90%', c: 'bg-emerald-100 text-emerald-700' },
                { g: 'A',  r: '≥ 80%', c: 'bg-green-100 text-green-700' },
                { g: 'B+', r: '≥ 70%', c: 'bg-teal-100 text-teal-700' },
                { g: 'B',  r: '≥ 60%', c: 'bg-blue-100 text-blue-700' },
                { g: 'C+', r: '≥ 50%', c: 'bg-indigo-100 text-indigo-700' },
                { g: 'C',  r: '≥ 40%', c: 'bg-yellow-100 text-yellow-700' },
                { g: 'D+', r: '≥ 30%', c: 'bg-orange-100 text-orange-700' },
                { g: 'D',  r: '< 30%', c: 'bg-red-100 text-red-700' },
              ].map(item => (
                <span key={item.g} className={`px-2.5 py-1.5 rounded-lg text-xs font-black ${item.c}`}>
                  {item.g} <span className="font-normal opacity-70">{item.r}</span>
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">E1, E2 &amp; Others</p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-500 font-medium">
              Grade system not applied — to be configured later
            </div>
          </div>
        </div>
      </div>

      {/* Exams List */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-slate-800 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" /> All Exams ({exams.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-slate-400 animate-pulse">Loading exams...</div>
        ) : exams.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-10 w-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">No exams created yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {exams.map(ex => (
              <div key={ex.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-sm">
                    {ex.batch}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{ex.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {ex.subject && <span className="font-medium text-indigo-600">{ex.subject} · </span>}
                      {ex.exam_date} · Max {ex.max_marks}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(ex.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete exam"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Results Tab ──────────────────────────────────────────────────────────────
const ResultsTab: React.FC = () => {
  const { activeBatches } = useBatches();
  const [batch, setBatch] = useState('');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (activeBatches.length > 0 && !batch) setBatch(activeBatches[0].name);
  }, [activeBatches]);

  useEffect(() => {
    if (!batch) return;
    const load = async () => {
      const { data } = await supabase.from('exams').select('*').eq('batch', batch).order('exam_date', { ascending: false });
      setExams(data || []);
      setSelectedExamId('');
      setResults([]);
    };
    load();
  }, [batch]);

  useEffect(() => {
    if (!selectedExamId) { setResults([]); setSelectedExam(null); return; }
    const ex = exams.find(e => e.id === selectedExamId) || null;
    setSelectedExam(ex);
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('exam_scores').select('*, students(*)').eq('exam_id', selectedExamId);
        const sorted = (data || []).sort((a, b) => {
          if (a.is_absent && !b.is_absent) return 1;
          if (!a.is_absent && b.is_absent) return -1;
          return (b.score || 0) - (a.score || 0);
        });
        setResults(sorted);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedExamId]);

  const generatePDF = () => {
    if (!selectedExam || results.length === 0) return;
    const doc = new jsPDF();

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setFontSize(18); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold');
    doc.text('Wings Coaching Center', 14, 12);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`${selectedExam.title} — Batch ${selectedExam.batch}`, 14, 22);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    doc.text(`Date: ${selectedExam.exam_date}   |   Max Marks: ${selectedExam.max_marks}   |   Subject: ${selectedExam.subject || '—'}`, 14, 40);

    let rank = 0;
    const tableData = results.map(r => {
      if (!r.is_absent) rank++;
      const p = calcPct(r.score, selectedExam.max_marks);
      return [
        r.is_absent ? '—' : String(rank),
        r.students?.name || '—',
        r.students?.roll_number || '—',
        r.is_absent ? 'ABSENT' : String(r.score ?? '—'),
        r.is_absent ? '—' : `${p}%`,
        r.is_absent ? 'AB' : getGradeLabel(p, selectedExam.batch),
      ];
    });

    (doc as any).autoTable({
      startY: 47,
      head: [['Rank', 'Student Name', 'Roll No', 'Score', '%', 'Grade']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontSize: 9, fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
        5: { cellWidth: 18, halign: 'center' },
      },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    const presentCount = results.filter(r => !r.is_absent).length;
    const sc = results.filter(r => !r.is_absent && r.score !== null).map(r => r.score);
    const avg = sc.length ? Math.round(sc.reduce((a: number, b: number) => a + b, 0) / sc.length) : 0;
    const highest = sc.length ? Math.max(...sc) : 0;
    doc.setFontSize(10);
    doc.text(`Present: ${presentCount}   |   Absent: ${results.length - presentCount}   |   Avg: ${avg}   |   Highest: ${highest}`, 14, finalY);

    doc.save(`Results_${selectedExam.batch}_${selectedExam.title}_${selectedExam.exam_date}.pdf`);
    toast.success('PDF downloaded!');
  };

  const presentCount  = results.filter(r => !r.is_absent).length;
  const absentCount   = results.filter(r => r.is_absent).length;
  const sc            = results.filter(r => !r.is_absent && r.score !== null).map(r => Number(r.score));
  const avgScore      = sc.length ? Math.round(sc.reduce((a, b) => a + b, 0) / sc.length) : 0;
  const highestScore  = sc.length ? Math.max(...sc) : 0;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Batch</label>
            <div className="relative">
              <select value={batch} onChange={e => setBatch(e.target.value)} className="w-full pl-4 pr-8 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 font-semibold appearance-none">
                {activeBatches.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Exam</label>
            <div className="relative">
              <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)} className="w-full pl-4 pr-8 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 font-semibold appearance-none">
                <option value="">— Select exam —</option>
                {exams.map(ex => <option key={ex.id} value={ex.id}>{ex.title}{ex.subject ? ` (${ex.subject})` : ''} · {ex.exam_date}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {selectedExam && results.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Present', value: presentCount, icon: <CheckCircle2 className="h-5 w-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
              { label: 'Absent',  value: absentCount,  icon: <XCircle className="h-5 w-5" />,       color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-100'     },
              { label: 'Average', value: avgScore,     icon: <BarChart2 className="h-5 w-5" />,      color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-100'    },
              { label: 'Highest', value: highestScore, icon: <Award className="h-5 w-5" />,          color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-100'  },
            ].map(card => (
              <div key={card.label} className={`${card.bg} border ${card.border} rounded-2xl p-4 flex items-center gap-3`}>
                <div className={card.color}>{card.icon}</div>
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{card.label}</p>
                  <p className={`text-2xl font-black ${card.color}`}>{card.value}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-black text-slate-800 flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" /> Rank List — {selectedExam.title}
              </h2>
              <button onClick={generatePDF} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl transition-all">
                <Download className="h-4 w-4" /> Download PDF
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-16">Rank</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Roll</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Score/{selectedExam.max_marks}</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">%</th>
                    <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(() => {
                    let rank = 0;
                    return results.map(r => {
                      if (!r.is_absent) rank++;
                      const p = calcPct(r.score, selectedExam.max_marks);
                      const grade = getGrade(p, selectedExam.batch);
                      const isTop3 = !r.is_absent && rank <= 3;
                      return (
                        <tr key={r.id} className={`transition-colors ${isTop3 ? 'bg-yellow-50/50 hover:bg-yellow-50' : 'hover:bg-slate-50'} ${r.is_absent ? 'opacity-60' : ''}`}>
                          <td className="p-4 text-center">
                            {!r.is_absent ? (
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-sm ${
                                rank === 1 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-300' :
                                rank === 2 ? 'bg-slate-200 text-slate-700' :
                                rank === 3 ? 'bg-orange-100 text-orange-700' : 'text-slate-400 font-bold'
                              }`}>
                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                              </span>
                            ) : <span className="text-slate-300 text-sm">—</span>}
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{r.students?.name}</td>
                          <td className="p-4 text-center text-slate-500 text-sm">{r.students?.roll_number || '—'}</td>
                          <td className="p-4 text-center font-bold text-slate-800">
                            {r.is_absent ? <span className="text-red-500 font-black">AB</span> : (r.score ?? '—')}
                          </td>
                          <td className="p-4 text-center">
                            {!r.is_absent && r.score !== null ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-bold text-sm">{p}%</span>
                                <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${p >= 75 ? 'bg-green-500' : p >= 45 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${p}%` }} />
                                </div>
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="p-4 text-center">
                            {!r.is_absent && r.score !== null ? (
                              <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black border ${grade.bg} ${grade.color} ${grade.border}`}>{grade.label}</span>
                            ) : r.is_absent ? <span className="text-red-400 font-bold text-xs">AB</span> : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {selectedExam && results.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <BarChart2 className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">No scores recorded yet</p>
          <p className="text-slate-300 text-sm mt-1">Go to "Mark Entry" to enter marks</p>
        </div>
      )}

      {!selectedExamId && (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
          <Trophy className="h-12 w-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 font-medium">Select an exam to view results</p>
        </div>
      )}
    </div>
  );
};

export default ExamPage;
