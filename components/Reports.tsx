import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parse } from 'date-fns';
import { supabase } from '../services/supabase';
import { StudentStats, Exam, ExamScore } from '../types';
import { useBatches } from '../context/BatchContext';
import { FileDown, Search, FileText, ChevronDown, Check, ClipboardCopy, Users, BarChart2, Award, TrendingUp, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

const Reports = () => {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch' | 'joins' | 'progress' | 'attendance_summary'>('individual');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>

      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-5 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'individual'
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Individual Report
        </button>
        <button
          onClick={() => setActiveTab('attendance_summary')}
          className={`px-5 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'attendance_summary'
            ? 'border-teal-600 text-teal-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Users className="h-4 w-4" />
          Attendance Summary
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`px-5 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'batch'
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Daily Batch PDF
        </button>
        <button
          onClick={() => setActiveTab('joins')}
          className={`px-5 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'joins'
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          New Joins
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-5 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'progress'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <BarChart2 className="h-4 w-4" />
          Progress Report
        </button>
      </div>

      {activeTab === 'individual' && <IndividualReport />}
      {activeTab === 'attendance_summary' && <AttendanceSummaryReport />}
      {activeTab === 'batch' && <BatchPDFReport />}
      {activeTab === 'joins' && <NewJoinsReport />}
      {activeTab === 'progress' && <ProgressReport />}
    </div>
  );
};

const IndividualReport = () => {
  const { activeBatches } = useBatches();
  const BATCHES = activeBatches.map(b => b.name);

  const [selectedBatch, setSelectedBatch] = useState('');
  const [batchStudents, setBatchStudents] = useState<{ id: string, name: string }[]>([]);
  const [searchName, setSearchName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [fromDate, setFromDate] = useState(format(new Date().setDate(new Date().getDate() - 30), 'dd-MM-yyyy'));
  const [toDate, setToDate] = useState(format(new Date(), 'dd-MM-yyyy'));
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (BATCHES.length > 0 && !selectedBatch) {
      setSelectedBatch(BATCHES[0]);
    }
  }, [BATCHES, selectedBatch]);

  // Fetch students for the selected batch
  React.useEffect(() => {
    const fetchBatchStudents = async () => {
      const { data } = await supabase
        .from('students')
        .select('id, name')
        .eq('batch', selectedBatch);

      if (data) {
        setBatchStudents(data.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setBatchStudents([]);
      }
      setSearchName('');
      setSelectedStudentId(null);
    };
    fetchBatchStudents();
  }, [selectedBatch]);

  // Filter suggestions
  const filteredSuggestions = batchStudents.filter(s =>
    s.name.toLowerCase().includes(searchName.toLowerCase())
  );

  const handleSelectStudent = (student: { id: string, name: string }) => {
    setSearchName(student.name);
    setSelectedStudentId(student.id);
    setIsSearching(false);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      toast.error('Please select a student from the list');
      return;
    }

    setLoading(true);
    setStats(null);

    try {
      setStudentName(searchName.toUpperCase());

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', selectedStudentId);

      if (!attendance) {
        setStats({ present: 0, absent: 0, details: [] });
        setLoading(false);
        return;
      }

      const fDate = parse(fromDate, 'dd-MM-yyyy', new Date());
      const tDate = parse(toDate, 'dd-MM-yyyy', new Date());

      const filtered = attendance.filter(r => {
        const rDate = parse(r.date, 'dd-MM-yyyy', new Date());
        return rDate >= fDate && rDate <= tDate;
      });

      const present = filtered.filter(r => r.status === 'Present').length;
      const absent = filtered.filter(r => r.status === 'Absent').length;

      filtered.sort((a, b) =>
        parse(b.date, 'dd-MM-yyyy', new Date()).getTime() -
        parse(a.date, 'dd-MM-yyyy', new Date()).getTime()
      );

      setStats({
        present,
        absent,
        details: filtered.map(r => ({ date: r.date, status: r.status }))
      });

    } catch (err) {
      console.error(err);
      toast.error('Error fetching report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-fit">
        <h3 className="font-bold text-lg mb-4 text-slate-700">Filters</h3>
        <form onSubmit={handleSearch} className="space-y-4">

          <div>
            <label className="text-sm font-medium text-slate-600">Select Batch</label>
            <div className="relative mt-1">
              <select
                className="w-full p-2 border rounded-lg bg-slate-50 outline-none focus:ring-2 focus:ring-blue-100 appearance-none cursor-pointer"
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
              >
                {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="relative">
            <label className="text-sm font-medium text-slate-600">Student Name</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={searchName}
                onFocus={() => setIsSearching(true)}
                onChange={e => {
                  setSearchName(e.target.value);
                  setIsSearching(true);
                  setSelectedStudentId(null);
                }}
                className={`w-full pl-9 pr-4 py-2 rounded-lg border outline-none uppercase placeholder:normal-case 
                    ${selectedStudentId ? 'border-green-500 ring-1 ring-green-100 bg-green-50' : 'focus:ring-2 focus:ring-blue-100'}`}
                placeholder="Start typing name..."
              />
              {selectedStudentId && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
              )}
            </div>

            {isSearching && searchName && !selectedStudentId && (
              <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map(student => (
                    <div
                      key={student.id}
                      onClick={() => handleSelectStudent(student)}
                      className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-sm text-slate-700 uppercase"
                    >
                      {student.name}
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-400 text-center">No students found</div>
                )}
              </div>
            )}
            {isSearching && (
              <div className="fixed inset-0 z-40" onClick={() => setIsSearching(false)}></div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-slate-500">From</label>
              <input
                type="date"
                required
                className="w-full mt-1 p-2 border rounded-lg text-sm"
                value={fromDate.split('-').reverse().join('-')}
                onChange={e => e.target.value && setFromDate(format(new Date(e.target.value), 'dd-MM-yyyy'))}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">To</label>
              <input
                type="date"
                required
                className="w-full mt-1 p-2 border rounded-lg text-sm"
                value={toDate.split('-').reverse().join('-')}
                onChange={e => e.target.value && setToDate(format(new Date(e.target.value), 'dd-MM-yyyy'))}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-primary text-white py-2 rounded-lg font-bold hover:bg-blue-800 disabled:opacity-50">
            {loading ? 'Searching...' : 'Generate Report'}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-6">
        {stats && (
          <>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-800 uppercase">{studentName}</h2>
                <p className="text-slate-500 text-sm">Report from {fromDate} to {toDate}</p>
              </div>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.present}</div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Present</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-500">{stats.absent}</div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Absent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round((stats.present / (stats.present + stats.absent || 1)) * 100)}%
                  </div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Rate</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {stats.details.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-6 py-3">{row.date}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${row.status === 'Present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Attendance Summary Report ────────────────────────────────────────────────
const AttendanceSummaryReport = () => {
  const { activeBatches } = useBatches();
  const BATCHES = activeBatches.map(b => b.name);

  const [selectedBatch, setSelectedBatch] = useState('');
  const [fromDate, setFromDate] = useState(format(new Date(new Date().setDate(1)), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generating, setGenerating] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  React.useEffect(() => {
    if (BATCHES.length > 0 && !selectedBatch) setSelectedBatch(BATCHES[0]);
  }, [BATCHES, selectedBatch]);

  // Live preview when filters change
  React.useEffect(() => {
    if (!selectedBatch || !fromDate || !toDate) return;
    const fetch = async () => {
      setIsFetching(true);
      try {
        const { data: students } = await supabase
          .from('students').select('id, name, roll_number, sex')
          .eq('batch', selectedBatch).order('roll_number', { ascending: true });
        if (!students?.length) { setPreviewRows([]); setIsFetching(false); return; }

        // Date range in dd-MM-yyyy format used in attendance table
        const from = format(new Date(fromDate), 'dd-MM-yyyy');
        const to   = format(new Date(toDate),   'dd-MM-yyyy');

        const { data: att } = await supabase
          .from('attendance').select('student_id, date, status')
          .in('student_id', students.map(s => s.id));

        const rows = students.map(s => {
          const records = (att || []).filter(a => {
            if (a.student_id !== s.id) return false;
            // compare dates lexicographically — works because dd-MM-yyyy with same format
            const parts = a.date.split('-').map(Number);
            const d = new Date(parts[2], parts[1] - 1, parts[0]);
            const fParts = from.split('-').map(Number);
            const fD = new Date(fParts[2], fParts[1] - 1, fParts[0]);
            const tParts = to.split('-').map(Number);
            const tD = new Date(tParts[2], tParts[1] - 1, tParts[0]);
            return d >= fD && d <= tD;
          });
          const present = records.filter(r => r.status === 'Present').length;
          const total   = records.length;
          const absent  = total - present;
          const pct     = total ? Math.round((present / total) * 100) : 0;
          return { ...s, present, absent, total, pct };
        });

        setPreviewRows(rows);
      } catch { setPreviewRows([]); }
      finally { setIsFetching(false); }
    };
    fetch();
  }, [selectedBatch, fromDate, toDate]);

  const buildData = async () => {
    const { data: students } = await supabase
      .from('students').select('id, name, roll_number, sex')
      .eq('batch', selectedBatch).order('roll_number', { ascending: true });
    if (!students?.length) throw new Error('No students');

    const from = format(new Date(fromDate), 'dd-MM-yyyy');
    const to   = format(new Date(toDate),   'dd-MM-yyyy');

    let allAtt: any[] = [];
    let page = 0, hasMore = true;
    while (hasMore) {
      const { data } = await supabase.from('attendance').select('student_id, date, status')
        .in('student_id', students.map(s => s.id))
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (data?.length) { allAtt = [...allAtt, ...data]; if (data.length < 1000) hasMore = false; else page++; }
      else hasMore = false;
    }

    return students.map(s => {
      const records = allAtt.filter(a => {
        if (a.student_id !== s.id) return false;
        const parts = a.date.split('-').map(Number);
        const d = new Date(parts[2], parts[1] - 1, parts[0]);
        const fParts = from.split('-').map(Number);
        const fD = new Date(fParts[2], fParts[1] - 1, fParts[0]);
        const tParts = to.split('-').map(Number);
        const tD = new Date(tParts[2], tParts[1] - 1, tParts[0]);
        return d >= fD && d <= tD;
      });
      const present = records.filter(r => r.status === 'Present').length;
      const total   = records.length;
      const absent  = total - present;
      const pct     = total ? Math.round((present / total) * 100) : 0;
      return { ...s, present, absent, total, pct };
    });
  };

  const generatePDF = async () => {
    if (!selectedBatch) { toast.error('Select a batch'); return; }
    setGenerating(true);
    try {
      const rows = await buildData();
      const fromFmt = format(new Date(fromDate), 'dd-MM-yyyy');
      const toFmt   = format(new Date(toDate),   'dd-MM-yyyy');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const BLACK = [0,0,0] as [number,number,number];
      const WHITE = [255,255,255] as [number,number,number];
      const DARK  = [30,30,30] as [number,number,number];

      // Header
      doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.setTextColor(...BLACK);
      doc.text('Wings Coaching Center, Karakunnu', 105, 14, { align: 'center' });
      doc.setFontSize(11);
      doc.text('Attendance Summary Report', 105, 21, { align: 'center' });
      doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
      doc.text(`Batch: ${selectedBatch}`, 14, 28);
      doc.text(`Period: ${fromFmt} to ${toFmt}`, 105, 28, { align: 'center' });
      doc.text(`Generated: ${format(new Date(),'dd-MM-yyyy')}`, 196, 28, { align: 'right' });
      doc.setDrawColor(...BLACK); doc.setLineWidth(0.4); doc.line(14, 31, 196, 31);

      const head = [['Roll No', 'Student Name', 'Present', 'Absent', 'Total Days', 'Attendance %']];
      const body = rows.map(r => [
        r.roll_number || '—',
        r.name,
        r.present,
        r.absent,
        r.total,
        `${r.pct}%`
      ]);

      (doc as any).autoTable({
        startY: 34,
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 9, halign: 'center', cellPadding: 2.5, textColor: [...BLACK] },
        headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 60, halign: 'left' },
          2: { cellWidth: 22 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 26 },
        },
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 5) {
            const pct = parseInt(data.cell.raw);
            data.cell.styles.textColor = pct >= 75 ? [22,163,74] : pct >= 50 ? [202,138,4] : [220,38,38];
            data.cell.styles.fontStyle = 'bold';
          }
        },
        alternateRowStyles: { fillColor: [250,250,250] },
        tableLineColor: [...BLACK],
        tableLineWidth: 0.2,
      });

      const finalY = (doc as any).lastAutoTable.finalY + 8;
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(...DARK);
      const total = rows.reduce((s, r) => s + r.total, 0);
      const presentTotal = rows.reduce((s, r) => s + r.present, 0);
      const avg = total ? Math.round((presentTotal / total) * 100) : 0;
      doc.text(`Total Students: ${rows.length}  |  Avg Attendance: ${avg}%`, 14, finalY);
      doc.setFont('helvetica','italic'); doc.setFontSize(6.5); doc.setTextColor(120,120,120);
      doc.text('Wings Attendance Tracker', 196, finalY, { align: 'right' });

      doc.save(`Attendance_Summary_${selectedBatch}_${fromFmt}_to_${toFmt}.pdf`);
      toast.success('✅ Attendance Summary PDF Downloaded!');
    } catch (err: any) {
      console.error(err); toast.error('Failed: ' + err.message);
    } finally { setGenerating(false); }
  };

  const generateExcel = async () => {
    if (!selectedBatch) { toast.error('Select a batch'); return; }
    setGeneratingExcel(true);
    try {
      const rows = await buildData();
      const fromFmt = format(new Date(fromDate), 'dd-MM-yyyy');
      const toFmt   = format(new Date(toDate),   'dd-MM-yyyy');
      const csv = Papa.unparse({
        fields: ['Roll No', 'Student Name', 'Sex', 'Present', 'Absent', 'Total Days', 'Attendance %'],
        data: rows.map(r => [r.roll_number || '—', r.name, r.sex, r.present, r.absent, r.total, `${r.pct}%`])
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Attendance_Summary_${selectedBatch}_${fromFmt}_to_${toFmt}.csv`;
      link.click();
      toast.success('✅ Attendance Summary Excel Downloaded!');
    } catch (err: any) {
      console.error(err); toast.error('Failed: ' + err.message);
    } finally { setGeneratingExcel(false); }
  };

  const overallAvg = previewRows.length
    ? Math.round(previewRows.reduce((s, r) => s + r.pct, 0) / previewRows.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 bg-teal-600 rounded-xl flex items-center justify-center">
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-800">Attendance Summary Report</h2>
            <p className="text-slate-500 text-sm">Select a batch and date range to view & print attendance summary</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Batch</label>
            <div className="relative">
              <select value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}
                className="w-full pl-4 pr-8 py-2.5 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-teal-100 font-semibold appearance-none">
                {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-100 font-semibold" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-100 font-semibold" />
          </div>
        </div>

        {/* Stats bar */}
        {previewRows.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-5 p-3 bg-teal-50 rounded-xl border border-teal-100">
            <div className="text-center min-w-[80px]">
              <p className="text-xs font-bold text-teal-600 uppercase tracking-widest">Students</p>
              <p className="text-2xl font-black text-teal-700">{previewRows.length}</p>
            </div>
            <div className="text-center min-w-[80px]">
              <p className="text-xs font-bold text-green-600 uppercase tracking-widest">Avg Attendance</p>
              <p className={`text-2xl font-black ${overallAvg >= 75 ? 'text-green-600' : overallAvg >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>{overallAvg}%</p>
            </div>
            <div className="text-center min-w-[80px]">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">≥75%</p>
              <p className="text-2xl font-black text-slate-700">{previewRows.filter(r => r.pct >= 75).length}</p>
            </div>
            <div className="text-center min-w-[80px]">
              <p className="text-xs font-bold text-red-500 uppercase tracking-widest">&lt;75%</p>
              <p className="text-2xl font-black text-red-600">{previewRows.filter(r => r.pct < 75).length}</p>
            </div>
          </div>
        )}

        {/* Download buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={generatePDF} disabled={generating || !selectedBatch}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-200 transition-all disabled:opacity-50 disabled:shadow-none flex-1">
            <FileDown className="h-5 w-5" />
            {generating ? 'Generating PDF...' : 'Download Attendance PDF'}
          </button>
          <button onClick={generateExcel} disabled={generatingExcel || !selectedBatch}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:shadow-none flex-1">
            <FileSpreadsheet className="h-5 w-5" />
            {generatingExcel ? 'Generating...' : 'Download as Excel'}
          </button>
        </div>
      </div>

      {/* Live Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-black text-slate-800">Preview — {selectedBatch || '...'} ({previewRows.length} students)</h3>
          {isFetching && <span className="text-xs font-bold text-teal-600 animate-pulse">Loading...</span>}
        </div>
        {previewRows.length === 0 && !isFetching ? (
          <div className="p-10 text-center text-slate-400 font-medium">No data for selected batch/range</div>
        ) : (
          <div className="overflow-x-auto max-h-[450px]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">Roll</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="px-4 py-3 text-center text-green-700">Present</th>
                  <th className="px-4 py-3 text-center text-red-600">Absent</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Attendance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {previewRows.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 text-center font-bold text-slate-500 text-xs">{r.roll_number || '—'}</td>
                    <td className="px-4 py-3 font-bold text-slate-800 uppercase">{r.name}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{r.present}</td>
                    <td className="px-4 py-3 text-center font-bold text-red-500">{r.absent}</td>
                    <td className="px-4 py-3 text-center text-slate-600 font-semibold">{r.total}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                        r.pct >= 75 ? 'bg-green-100 text-green-700' :
                        r.pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'}`}>
                        {r.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const BatchPDFReport = () => {
  const { activeBatches } = useBatches();
  const BATCHES = activeBatches.map(b => b.name);

  const [batch, setBatch] = useState('');
  const [date, setDate] = useState(format(new Date(), 'dd-MM-yyyy'));
  const [generating, setGenerating] = useState(false);

  React.useEffect(() => {
    if (BATCHES.length > 0 && !batch) {
      setBatch(BATCHES[0]);
    }
  }, [BATCHES, batch]);

  const generatePDF = async () => {
    setGenerating(true);
    try {
      // Fetch Data
      const { data: students } = await supabase
        .from('students')
        .select('*')
        .eq('batch', batch);

      if (!students?.length) {
        toast.error('No students found in batch');
        setGenerating(false);
        return;
      }

      // Sort: Female -> Male, then Language, then Alphabetical
      const langOrder: Record<string, number> = { 'Malayalam': 1, 'Arabic': 2, 'Sanskrit': 3, 'Urdu': 4 };
      students.sort((a, b) => {
        if (a.sex !== b.sex) return a.sex === 'Female' ? -1 : 1;
        const lA = langOrder[a.first_language || 'Malayalam'] || 99;
        const lB = langOrder[b.first_language || 'Malayalam'] || 99;
        if (lA !== lB) return lA - lB;
        return a.name.localeCompare(b.name);
      });

      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('date', date)
        .in('student_id', students.map(s => s.id));

      const statusMap = new Map();
      attendance?.forEach(a => statusMap.set(a.student_id, a.status));

      // PDF Generation
      const doc = new jsPDF();

      // Header
      doc.setFontSize(20);
      doc.setTextColor(30, 58, 138); // Primary Color
      doc.text("Wings Coaching Center, Karakunnu", 105, 15, { align: 'center' });

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Daily Attendance Report`, 105, 22, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`Batch: ${batch}`, 14, 30);
      doc.text(`Date: ${date}`, 14, 35);

      const tableData = students.map((s, index) => {
        const status = statusMap.get(s.id) || 'Absent';

        // Show Roll Number if available and valid, else use Index+1
        const hasValidRoll = s.roll_number && s.roll_number !== '00';
        const rollNo = hasValidRoll ? s.roll_number : (index + 1).toString();

        return [rollNo, s.name.toUpperCase(), status];
      });

      // Table
      autoTable(doc, {
        startY: 40,
        head: [['Roll No', 'Student Name', 'Status']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138], textColor: 255 },
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          2: { fontStyle: 'bold', textColor: [0, 0, 0] }
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 2) {
            if (data.cell.raw === 'Present') {
              data.cell.styles.textColor = [34, 197, 94]; // Green
            } else {
              data.cell.styles.textColor = [239, 68, 68]; // Red
            }
          }
        }
      });

      // Stats Footer
      const presentCount = Array.from(statusMap.values()).filter(s => s === 'Present').length;
      const absentCount = students.length - presentCount;
      const finalY = (doc as any).lastAutoTable.finalY + 10;

      doc.setFontSize(10);
      doc.setTextColor(0);
      doc.text(`Total Present: ${presentCount}`, 14, finalY);
      doc.text(`Total Absent: ${absentCount}`, 60, finalY);

      doc.save(`Attendance_${batch}_${date}.pdf`);
      toast.success('PDF Generated');

    } catch (err) {
      console.error(err);
      toast.error('Failed to generate PDF');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 max-w-xl mx-auto text-center">
      <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <FileText className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-slate-800 mb-2">Generate Daily PDF</h2>
      <p className="text-slate-500 mb-6">Download a clean printable list of attendance sorted by Roll No (Female First).</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-left">
          <label className="block text-sm font-medium text-slate-600 mb-1">Select Batch</label>
          <select
            className="w-full p-2 border rounded-lg bg-white"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
          >
            {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="text-left">
          <label className="block text-sm font-medium text-slate-600 mb-1">Select Date</label>
          <input
            type="date"
            className="w-full p-2 border rounded-lg bg-white"
            value={date.split('-').reverse().join('-')}
            onChange={(e) => e.target.value && setDate(format(new Date(e.target.value), 'dd-MM-yyyy'))}
          />
        </div>
      </div>

      <button
        onClick={generatePDF}
        disabled={generating}
        className="w-full bg-primary hover:bg-blue-800 text-white font-bold py-3 rounded-lg shadow-lg shadow-blue-900/10 flex items-center justify-center gap-2 transition-all"
      >
        {generating ? 'Generating...' : (
          <>
            <FileDown className="h-5 w-5" />
            Download Report
          </>
        )}
      </button>
    </div>
  );
};

const NewJoinsReport = () => {
  const { activeBatches } = useBatches();
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportBatch, setReportBatch] = useState('ALL');
  const [reportLoading, setReportLoading] = useState(false);
  
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    const fetchPreviewData = async () => {
      if (!reportDate) return;
      setIsFetching(true);
      try {
        const startDate = `${reportDate}T00:00:00.000Z`;
        const endDate = `${reportDate}T23:59:59.999Z`;

        let query = supabase.from('students').select('*')
          .gte('created_at', startDate)
          .lte('created_at', endDate)
          .order('batch', { ascending: true })
          .order('name', { ascending: true });

        if (reportBatch !== 'ALL') {
          query = query.eq('batch', reportBatch);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        const fetchedData = data || [];
        const langOrder: Record<string, number> = { 'Malayalam': 1, 'Arabic': 2, 'Sanskrit': 3, 'Urdu': 4 };
        fetchedData.sort((a, b) => {
          if (a.batch !== b.batch) return a.batch.localeCompare(b.batch);
          if (a.sex !== b.sex) return a.sex === 'Female' ? -1 : 1;
          const lA = langOrder[a.first_language || 'Malayalam'] || 99;
          const lB = langOrder[b.first_language || 'Malayalam'] || 99;
          if (lA !== lB) return lA - lB;
          return a.name.localeCompare(b.name);
        });

        setPreviewData(fetchedData);
      } catch (err) {
        console.error("Failed to fetch preview:", err);
      } finally {
        setIsFetching(false);
      }
    };
    fetchPreviewData();
  }, [reportDate, reportBatch]);

  const handleGenerateRegistrationReport = async () => {
    if (previewData.length === 0) {
      toast.error(`No students registered on ${reportDate}`);
      return;
    }
    setReportLoading(true);
    try {
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("New Registrations Report", 14, 20);
      doc.setFontSize(11);
      doc.text(`Date: ${format(new Date(reportDate), 'dd-MM-yyyy')}`, 14, 28);
      doc.text(`Batch: ${reportBatch}`, 14, 34);
      doc.text(`Total Registrations: ${previewData.length}`, 14, 40);

      const tableData = previewData.map((s, index) => [
        index + 1,
        s.register_number || '-',
        s.name,
        s.batch,
        s.sex,
        s.phone_number || '-',
        s.medium || '-'
      ]);

      (doc as any).autoTable({
        startY: 45,
        head: [['#', 'Reg No', 'Name', 'Batch', 'Sex', 'Phone', 'Medium']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        styles: { fontSize: 9 }
      });

      doc.save(`Registrations_${reportDate}_${reportBatch}.pdf`);
      toast.success("Report Generated");
    } catch (err: any) {
      toast.error('Failed to generate report');
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleCopyForWhatsapp = async () => {
    if (previewData.length === 0) {
      toast.error(`No students found for ${reportDate}`);
      return;
    }
    setReportLoading(true);
    try {
      let message = `*New Registrations - ${format(new Date(reportDate), 'dd-MM-yyyy')}*\n\n`;
      const batchCounts: Record<string, number> = {};

      previewData.forEach(s => {
        batchCounts[s.batch] = (batchCounts[s.batch] || 0) + 1;
      });

      Object.entries(batchCounts).forEach(([b, count]) => {
        message += `*Batch ${b}*: ${count} student${count > 1 ? 's' : ''}\n`;
      });

      const totalCount = previewData.length;
      message += `\n*Total*: ${totalCount} new registration${totalCount > 1 ? 's' : ''}`;

      await navigator.clipboard.writeText(message);
      toast.success("Copied to clipboard for WhatsApp!");
    } catch (err: any) {
      toast.error('Failed to copy');
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-100 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-6">
        <div>
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">New Join Registrations</h2>
          <p className="text-slate-500 text-sm max-w-xl">Find students joined by a specific date, preview the list, and export it instantly.</p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleGenerateRegistrationReport}
            disabled={reportLoading || previewData.length === 0}
            className="bg-primary hover:bg-blue-800 text-white font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-900/10 disabled:bg-slate-300 disabled:shadow-none text-sm"
          >
            <FileDown className="h-4 w-4" /> PDF Report
          </button>
          <button
            onClick={handleCopyForWhatsapp}
            disabled={reportLoading || previewData.length === 0}
            className="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md shadow-green-900/10 disabled:bg-slate-300 disabled:shadow-none text-sm"
          >
            <ClipboardCopy className="h-4 w-4" /> WA Copy
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Join Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 bg-white font-semibold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Batch Filter</label>
          <select
            value={reportBatch}
            onChange={e => setReportBatch(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 bg-white font-medium"
          >
            <option value="ALL">All Batches</option>
            {activeBatches.map(b => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-700 text-sm">Join Preview ({previewData.length})</h3>
          {isFetching && <span className="text-xs font-bold text-blue-600 animate-pulse">Loading...</span>}
        </div>
        
        {previewData.length === 0 && !isFetching ? (
          <div className="p-8 text-center text-slate-500 font-medium">
            No students found for this date {reportBatch !== 'ALL' && `in ${reportBatch}`}.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm ring-1 ring-slate-100">
                <tr className="text-slate-500 text-xs uppercase tracking-wider">
                  <th className="p-4 font-bold border-b border-slate-100 w-12 text-center">#</th>
                  <th className="p-4 font-bold border-b border-slate-100">Reg No</th>
                  <th className="p-4 font-bold border-b border-slate-100">Name</th>
                  <th className="p-4 font-bold border-b border-slate-100">Batch</th>
                  <th className="p-4 font-bold border-b border-slate-100">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 bg-white">
                {previewData.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm font-bold text-slate-400 text-center">{index + 1}</td>
                    <td className="p-4 text-sm font-semibold text-slate-600">{student.register_number || '-'}</td>
                    <td className="p-4 text-sm font-bold text-slate-800">{student.name}</td>
                    <td className="p-4 text-sm">
                      <span className="bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded font-bold text-[10px] uppercase tracking-wider">
                        {student.batch}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 font-medium">{student.phone_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Progress Report ──────────────────────────────────────────────────────────
const GRADED_BATCHES_PR = ['S1', 'S2', 'S3', 'N1', 'N2'];

const getPRGradeLabel = (pct: number, batch?: string): string => {
  if (batch && !GRADED_BATCHES_PR.includes(batch)) return '—';
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C+';
  if (pct >= 40) return 'C';
  if (pct >= 30) return 'D+';
  if (pct > 0)   return 'D';
  return 'E';
};

const getPRGrade = (pct: number, batch?: string) => {
  if (batch && !GRADED_BATCHES_PR.includes(batch)) {
    return { label: '—', color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' };
  }
  if (pct >= 90) return { label: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300' };
  if (pct >= 80) return { label: 'A',  color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-300'   };
  if (pct >= 70) return { label: 'B+', color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-300'    };
  if (pct >= 60) return { label: 'B',  color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-300'    };
  if (pct >= 50) return { label: 'C+', color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-300'  };
  if (pct >= 40) return { label: 'C',  color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-300'  };
  if (pct >= 30) return { label: 'D+', color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-300'  };
  if (pct > 0)   return { label: 'D',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-300'     };
  return { label: 'E', color: 'text-red-900', bg: 'bg-red-100', border: 'border-red-400' };
};

const ProgressReport = () => {
  const { activeBatches } = useBatches();
  const BATCHES = activeBatches.map(b => b.name);

  // Individual
  const [selBatch, setSelBatch] = useState('');
  const [students, setStudents] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [fromDate, setFromDate] = useState(format(new Date().setDate(1), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [studentReport, setStudentReport] = useState<any>(null);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Batch PDF
  const [pdfBatch, setPdfBatch] = useState('');
  const [pdfFrom, setPdfFrom] = useState(format(new Date().setDate(1), 'yyyy-MM-dd'));
  const [pdfTo, setPdfTo] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportTitle, setReportTitle] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<'individual' | 'batch' | 'consolidated' | 'pta'>('individual');
  const [ptaDate, setPtaDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [generatingConsolidated, setGeneratingConsolidated] = useState(false);
  const [generatingConsolidatedExcel, setGeneratingConsolidatedExcel] = useState(false);
  const [generatingPta, setGeneratingPta] = useState(false);

  // Exam selection for Batch PDF
  const [availableExams, setAvailableExams] = useState<any[]>([]);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);

  useEffect(() => {
    if (BATCHES.length > 0) {
      if (!selBatch) setSelBatch(BATCHES[0]);
      if (!pdfBatch) setPdfBatch(BATCHES[0]);
    }
  }, [BATCHES]);

  // Fetch exams when pdfBatch changes
  useEffect(() => {
    if (!pdfBatch) return;
    const fetchExams = async () => {
      setLoadingExams(true);
      const { data } = await supabase.from('exams').select('*')
        .eq('batch', pdfBatch).order('exam_date', { ascending: true });
      const exams = data || [];
      setAvailableExams(exams);
      setSelectedExamIds(exams.map((e: any) => e.id)); // select all by default
      setLoadingExams(false);
    };
    fetchExams();
  }, [pdfBatch]);

  useEffect(() => {
    if (!selBatch) return;
    const f = async () => {
      const { data } = await supabase.from('students').select('id, name').eq('batch', selBatch).order('name');
      setStudents(data || []);
      setSearchName(''); setSelectedStudentId(null); setStudentReport(null);
    };
    f();
  }, [selBatch]);

  const filteredSuggestions = students.filter(s => s.name.toLowerCase().includes(searchName.toLowerCase()));

  const handleLoadStudentReport = async () => {
    if (!selectedStudentId) { toast.error('Select a student'); return; }
    setLoadingStudent(true);
    try {
      const [{ data: student }, { data: attendance }, { data: examScores }] = await Promise.all([
        supabase.from('students').select('*').eq('id', selectedStudentId).single(),
        supabase.from('attendance').select('*').eq('student_id', selectedStudentId)
          .gte('date', fromDate.split('-').reverse().join('-'))
          .lte('date', toDate.split('-').reverse().join('-')),
        supabase.from('exam_scores').select('*, exams(*)').eq('student_id', selectedStudentId),
      ]);

      const presentDays = (attendance || []).filter(a => a.status === 'Present').length;
      const totalDays = (attendance || []).length;
      const pct = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

      const exScores = (examScores || []).filter(es => {
        const ex = es.exams;
        if (!ex) return false;
        return ex.exam_date >= fromDate && ex.exam_date <= toDate;
      });

      setStudentReport({ student, presentDays, totalDays, pct, examScores: exScores });
    } catch {
      toast.error('Failed to load report');
    } finally {
      setLoadingStudent(false);
    }
  };

  // ── A4 LANDSCAPE B&W PDF ──────────────────────────────────────────────────
  const generateBatchPDF = async () => {
    if (!pdfBatch) { toast.error('Select a batch'); return; }
    setGeneratingPdf(true);
    try {
      const { data: studs } = await supabase.from('students').select('*')
        .eq('batch', pdfBatch).neq('batch', 'ALUMNI')
        .order('roll_number', { ascending: true });
      if (!studs?.length) { toast.error('No students in batch'); return; }

      // Fetch attendance with pagination to bypass 1000-row limit
      let allAttendance: any[] = [];
      let page = 0;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await supabase.from('attendance').select('*')
          .in('student_id', studs.map(s => s.id))
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allAttendance = [...allAttendance, ...data];
          if (data.length < 1000) hasMore = false;
          else page++;
        } else {
          hasMore = false;
        }
      }

      // Use only the explicitly selected exams (from the checklist)
      const allExams = availableExams.filter(e => selectedExamIds.includes(e.id))
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

      // Fetch exam scores with pagination for the selected exam IDs
      let allScores: any[] = [];
      const examIds = allExams.map(e => e.id);
      if (examIds.length > 0) {
        let scorePage = 0;
        let scoresHasMore = true;
        while (scoresHasMore) {
          const { data, error } = await supabase.from('exam_scores').select('*')
            .in('exam_id', examIds)
            .range(scorePage * 1000, (scorePage + 1) * 1000 - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allScores = [...allScores, ...data];
            if (data.length < 1000) scoresHasMore = false;
            else scorePage++;
          } else {
            scoresHasMore = false;
          }
        }
      }

      // A4 Landscape: 297 × 210 mm  |  4 cards per page (2 cols × 2 rows), each ~148.5 × 105 mm (A6)
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PAGE_W = 297;
      const PAGE_H = 210;
      const CARD_W = PAGE_W / 2;   // 148.5mm
      const CARD_H = PAGE_H / 2;   // 105mm
      const PAD = 4;               // inner padding

      // ── B&W colour constants ──
      const BLACK  = [0, 0, 0]         as [number, number, number];
      const DARK   = [20, 20, 20]      as [number, number, number];
      const LIGHT  = [160, 160, 160]   as [number, number, number];
      const WHITE  = [255, 255, 255]   as [number, number, number];

      const repTitleStr = reportTitle ? reportTitle : 'Progress Report';
      const iw = CARD_W - PAD * 2; // inner width

      const drawCard = (student: any, xOff: number, yOff: number) => {
        // ── Outer border ──
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.5);
        doc.rect(xOff, yOff, CARD_W, CARD_H);

        // ── HEADER (~15mm) ──
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...BLACK);
        doc.text('Wings Coaching Center', xOff + CARD_W / 2, yOff + 7, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK);
        doc.text(`Karakunnu   |   ${repTitleStr}`, xOff + CARD_W / 2, yOff + 12, { align: 'center' });

        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.4);
        doc.line(xOff + PAD, yOff + 15, xOff + CARD_W - PAD, yOff + 15);

        // ── STUDENT INFO ROW (3-cell bordered table) ──
        const infoY = yOff + 15;
        const infoH = 11;
        const c1W = iw * 0.42;
        const c2W = iw * 0.20;
        const c3W = iw - c1W - c2W;
        const c1X = xOff + PAD;
        const c2X = c1X + c1W;
        const c3X = c2X + c2W;

        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.3);
        doc.rect(c1X, infoY, c1W, infoH);
        doc.rect(c2X, infoY, c2W, infoH);
        doc.rect(c3X, infoY, c3W, infoH);

        // Cell 1: Name + Roll
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...BLACK);
        const nameStr = student.name.length > 22
          ? student.name.substring(0, 22).toUpperCase() + '…'
          : student.name.toUpperCase();
        doc.text(nameStr, c1X + 2, infoY + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...DARK);
        doc.text(`Roll No: ${student.roll_number || '—'}`, c1X + 2, infoY + 8.5);

        // Cell 2: Batch + Sex
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...BLACK);
        doc.text(`Batch: ${student.batch}`, c2X + 2, infoY + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...DARK);
        doc.text(student.sex || '', c2X + 2, infoY + 8.5);

        // Cell 3: Attendance
        const attForStudent = (allAttendance || []).filter((a: any) => {
          if (a.student_id !== student.id) return false;
          const d = a.date.split('-').reverse().join('-');
          return d >= pdfFrom && d <= pdfTo;
        });
        const presentDays = attForStudent.filter((a: any) => a.status === 'Present').length;
        const totalDays = attForStudent.length;
        const absentDays = totalDays - presentDays;
        const attPct = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.setTextColor(...BLACK);
        doc.text(`${presentDays}P / ${absentDays}A / ${totalDays} Days`, c3X + 2, infoY + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...DARK);
        doc.text(`Attendance: ${attPct}%`, c3X + 2, infoY + 8.5);

        // ── EXAM SCORES TABLE ──
        const tStartY = infoY + infoH + 1;
        const rowH = 7;
        // Columns: Subject | Max | Score | Grade
        const tCols = [iw * 0.46, iw * 0.16, iw * 0.21, iw * 0.17];
        const tX = [
          xOff + PAD,
          xOff + PAD + tCols[0],
          xOff + PAD + tCols[0] + tCols[1],
          xOff + PAD + tCols[0] + tCols[1] + tCols[2],
        ];

        // Header row (solid black fill)
        doc.setFillColor(...BLACK);
        doc.rect(xOff + PAD, tStartY, iw, rowH, 'F');

        // Header vertical dividers (white)
        doc.setDrawColor(...WHITE);
        doc.setLineWidth(0.2);
        tX.slice(1).forEach(cx => doc.line(cx, tStartY, cx, tStartY + rowH));

        // Header text (white)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...WHITE);
        doc.text('Subject', tX[0] + 2, tStartY + 4.5);
        doc.text('Max',   tX[1] + tCols[1] / 2, tStartY + 4.5, { align: 'center' });
        doc.text('Score', tX[2] + tCols[2] / 2, tStartY + 4.5, { align: 'center' });
        doc.text('Grade', tX[3] + tCols[3] / 2, tStartY + 4.5, { align: 'center' });

        // Header outer border
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.3);
        doc.rect(xOff + PAD, tStartY, iw, rowH);

        // Data rows
        const studentScores = (allScores || []).filter((sc: any) => sc.student_id === student.id);
        const examsData = allExams.map((ex: any) => ({
          exam: ex,
          score: studentScores.find((s: any) => s.exam_id === ex.id),
        }));

        const maxRows = Math.min(examsData.length, 7);
        examsData.slice(0, maxRows).forEach((es: any, i: number) => {
          const rowY = tStartY + rowH + i * rowH;
          const isAbsent = es.score?.is_absent;
          const rawScore = es.score?.score;
          const max = es.exam.max_marks;
          const scorePct = isAbsent || rawScore === null || rawScore === undefined
            ? 0 : Math.round((rawScore / max) * 100);
          const gradeLabel = isAbsent ? 'AB' : getPRGradeLabel(scorePct, pdfBatch);
          const scoreText = isAbsent ? 'AB'
            : (rawScore !== null && rawScore !== undefined ? String(rawScore) : '—');
          const subjectTitle = es.exam.subject
            ? es.exam.subject
            : (es.exam.title.length > 24 ? es.exam.title.substring(0, 24) + '…' : es.exam.title);

          // Row border
          doc.setDrawColor(...BLACK);
          doc.setLineWidth(0.25);
          doc.rect(xOff + PAD, rowY, iw, rowH);
          tX.slice(1).forEach(cx => doc.line(cx, rowY, cx, rowY + rowH));

          // Row text
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...BLACK);
          doc.text(subjectTitle, tX[0] + 2, rowY + 4.5);

          doc.setFont('helvetica', 'bold');
          doc.text(String(max),   tX[1] + tCols[1] / 2, rowY + 4.5, { align: 'center' });
          doc.text(scoreText,     tX[2] + tCols[2] / 2, rowY + 4.5, { align: 'center' });
          doc.text(gradeLabel,    tX[3] + tCols[3] / 2, rowY + 4.5, { align: 'center' });
        });

        if (examsData.length > maxRows) {
          const moreY = tStartY + rowH + maxRows * rowH + 4;
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6);
          doc.setTextColor(...LIGHT);
          doc.text(`+${examsData.length - maxRows} more exams…`, xOff + PAD + 2, moreY);
        }

        // ── SIGNATURE ROW (fixed at card bottom) ──
        const sigY = yOff + CARD_H - 15;
        const sigH = 13;
        const halfW = iw / 2;

        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.3);
        doc.rect(xOff + PAD, sigY, halfW, sigH);
        doc.rect(xOff + PAD + halfW, sigY, halfW, sigH);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...BLACK);
        doc.text('Class Teacher Sign:', xOff + PAD + 2, sigY + 4.5);
        doc.text('Parent Sign:', xOff + PAD + halfW + 2, sigY + 4.5);

        // Dotted signature lines
        doc.setDrawColor(...DARK);
        doc.setLineWidth(0.2);
        (doc as any).setLineDash([0.5, 1.5]);
        doc.line(xOff + PAD + 2, sigY + 10, xOff + PAD + halfW - 3, sigY + 10);
        doc.line(xOff + PAD + halfW + 2, sigY + 10, xOff + CARD_W - PAD - 2, sigY + 10);
        (doc as any).setLineDash([]);

        // (no footer text — removed to avoid overlap with signature section)
      };

      // ── DRAW CUT GUIDES on current page ──
      const drawCutGuides = () => {
        doc.setDrawColor(150, 150, 150);
        doc.setLineWidth(0.2);
        (doc as any).setLineDash([2, 2]);
        // Vertical centre line
        doc.line(CARD_W, 2, CARD_W, PAGE_H - 2);
        // Horizontal centre line
        doc.line(2, CARD_H, PAGE_W - 2, CARD_H);
        (doc as any).setLineDash([]);
        // ✂ labels
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(150, 150, 150);
        doc.text('✂', CARD_W, 1.5, { align: 'center' });
        doc.text('✂', 1.5, CARD_H - 0.5);
      };

      // ── RENDER PAGES (4 cards per page: 2 cols × 2 rows) ──
      for (let i = 0; i < studs.length; i++) {
        const cardInPage = i % 4;
        if (cardInPage === 0 && i > 0) {
          drawCutGuides();
          doc.addPage();
        }

        const col = cardInPage % 2;
        const row = Math.floor(cardInPage / 2);
        drawCard(studs[i], col * CARD_W, row * CARD_H);

        // Draw cut guides on the very last card
        if (i === studs.length - 1) {
          drawCutGuides();
        }
      }

      doc.save(`Progress_Report_${pdfBatch}_${pdfFrom}_to_${pdfTo}.pdf`);
      toast.success('✅ Progress Report PDF Downloaded!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to generate PDF: ' + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  // ── CONSOLIDATED MARKS REPORT (A4 Portrait) ──────────────────────────────
  const generateConsolidatedPDF = async () => {
    if (!pdfBatch) { toast.error('Select a batch'); return; }
    if (selectedExamIds.length === 0) { toast.error('Select at least one exam'); return; }
    setGeneratingConsolidated(true);
    try {
      const { data: studs } = await supabase.from('students').select('*')
        .eq('batch', pdfBatch).neq('batch', 'ALUMNI')
        .order('roll_number', { ascending: true });
      if (!studs?.length) { toast.error('No students in batch'); return; }

      const selExams = availableExams
        .filter(e => selectedExamIds.includes(e.id))
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

      let allScores: any[] = [];
      if (selExams.length > 0) {
        const { data } = await supabase.from('exam_scores').select('*')
          .in('exam_id', selExams.map(e => e.id));
        allScores = data || [];
      }

      // Build rows: per student, compute per-exam score + total
      const rows = studs.map(student => {
        const studentScores = allScores.filter(sc => sc.student_id === student.id);
        let total = 0;
        const subScores = selExams.map(ex => {
          const sc = studentScores.find(s => s.exam_id === ex.id);
          if (!sc || sc.is_absent) return { display: sc?.is_absent ? 'AB' : '—', value: 0, scored: false };
          const v = sc.score !== null && sc.score !== undefined ? sc.score : null;
          if (v !== null) { total += v; return { display: String(v), value: v, scored: true }; }
          return { display: '—', value: 0, scored: false };
        });
        return { student, subScores, total };
      });

      // Sort by total descending → rank
      rows.sort((a, b) => b.total - a.total);

      const totalMax = selExams.reduce((s, e) => s + (e.max_marks || 0), 0);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const BLACK = [0, 0, 0] as [number, number, number];
      const WHITE = [255, 255, 255] as [number, number, number];
      const DARK  = [20, 20, 20]  as [number, number, number];
      const LIGHT = [160, 160, 160] as [number, number, number];

      // ── Header ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...BLACK);
      doc.text('Wings Coaching Center, Karakunnu', 105, 14, { align: 'center' });
      doc.setFontSize(11);
      doc.text('Consolidated Marks Report', 105, 21, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      const examLabel = reportTitle || selExams.map(e => e.subject || e.title).join(', ');
      doc.text(`Batch: ${pdfBatch}`, 14, 28);
      doc.text(`Exam: ${examLabel}`, 105, 28, { align: 'center' });
      doc.text(`Date: ${format(new Date(), 'dd-MM-yyyy')}`, 196, 28, { align: 'right' });
      doc.setDrawColor(...BLACK);
      doc.setLineWidth(0.4);
      doc.line(14, 31, 196, 31);

      // ── Table ──
      const head = [[
        'Rank', 'Roll No', 'Student Name',
        ...selExams.map(e => `${e.subject || e.title}\n/${e.max_marks}`),
        `Total\n/${totalMax}`
      ]];

      const body = rows.map((r, idx) => [
        idx + 1,
        r.student.roll_number || '—',
        r.student.name,
        ...r.subScores.map(s => s.display),
        r.total > 0 ? r.total : '—'
      ]);

      (doc as any).autoTable({
        startY: 34,
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 8, halign: 'center', cellPadding: 2.5, textColor: [...BLACK] },
        headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: {
          0: { cellWidth: 12 },
          1: { cellWidth: 14 },
          2: { cellWidth: 40, halign: 'left' },
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        tableLineColor: [...BLACK],
        tableLineWidth: 0.3,
      });

      // ── Footer ──
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setDrawColor(...DARK);
      doc.setLineWidth(0.3);
      (doc as any).setLineDash([0.5, 1.5]);
      doc.line(14, finalY + 8, 90, finalY + 8);
      doc.line(110, finalY + 8, 196, finalY + 8);
      (doc as any).setLineDash([]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      doc.text('Class Teacher Sign', 14, finalY + 12);
      doc.text('Principal Sign', 110, finalY + 12);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(...LIGHT);
      doc.text(`Total Students: ${studs.length} | Generated: ${format(new Date(), 'dd-MM-yyyy')}`, 105, finalY + 18, { align: 'center' });

      doc.save(`Consolidated_${pdfBatch}_${reportTitle || 'Report'}.pdf`);
      toast.success('✅ Consolidated Report Downloaded!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed: ' + err.message);
    } finally {
      setGeneratingConsolidated(false);
    }
  };

  const generateConsolidatedExcel = async () => {
    if (!pdfBatch) { toast.error('Select a batch'); return; }
    if (selectedExamIds.length === 0) { toast.error('Select at least one exam'); return; }
    setGeneratingConsolidatedExcel(true);
    try {
      const { data: studs } = await supabase.from('students').select('*')
        .eq('batch', pdfBatch).neq('batch', 'ALUMNI')
        .order('roll_number', { ascending: true });
      if (!studs?.length) { toast.error('No students in batch'); return; }

      const selExams = availableExams
        .filter(e => selectedExamIds.includes(e.id))
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

      let allScores: any[] = [];
      if (selExams.length > 0) {
        const { data } = await supabase.from('exam_scores').select('*')
          .in('exam_id', selExams.map(e => e.id));
        allScores = data || [];
      }

      // Build rows: per student, compute per-exam score + total
      const rows = studs.map(student => {
        const studentScores = allScores.filter(sc => sc.student_id === student.id);
        let total = 0;
        const subScores = selExams.map(ex => {
          const sc = studentScores.find(s => s.exam_id === ex.id);
          if (!sc || sc.is_absent) return { display: sc?.is_absent ? 'AB' : '—', value: 0, scored: false };
          const v = sc.score !== null && sc.score !== undefined ? sc.score : null;
          if (v !== null) { total += v; return { display: String(v), value: v, scored: true }; }
          return { display: '—', value: 0, scored: false };
        });
        return { student, subScores, total };
      });

      // Sort by total descending → rank
      rows.sort((a, b) => b.total - a.total);

      const totalMax = selExams.reduce((s, e) => s + (e.max_marks || 0), 0);

      // Prepare data for Excel/CSV export
      const headers = [
        'Rank',
        'Roll No',
        'Student Name',
        ...selExams.map(e => `${e.subject || e.title} (Max: ${e.max_marks})`),
        `Total (Max: ${totalMax})`
      ];

      const csvRows = rows.map((r, idx) => [
        idx + 1,
        r.student.roll_number || '—',
        r.student.name,
        ...r.subScores.map(s => s.display),
        r.total > 0 ? r.total : '—'
      ]);

      const csv = Papa.unparse({
        fields: headers,
        data: csvRows
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Consolidated_${pdfBatch}_${reportTitle || 'Report'}.csv`;
      link.click();
      toast.success('✅ Consolidated Excel Sheet (CSV) Downloaded!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed: ' + err.message);
    } finally {
      setGeneratingConsolidatedExcel(false);
    }
  };

  // ── PTA MEETING REGISTER (A4 Portrait) ────────────────────────────────────
  const generatePTARegister = async () => {
    if (!pdfBatch) { toast.error('Select a batch'); return; }
    setGeneratingPta(true);
    try {
      const { data: studs } = await supabase.from('students').select('*')
        .eq('batch', pdfBatch).neq('batch', 'ALUMNI')
        .order('roll_number', { ascending: true });
      if (!studs?.length) { toast.error('No students in batch'); return; }

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const BLACK = [0, 0, 0]   as [number, number, number];
      const WHITE = [255, 255, 255] as [number, number, number];
      const DARK  = [20, 20, 20]   as [number, number, number];
      const LIGHT = [160, 160, 160] as [number, number, number];

      // ── Header ──
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...BLACK);
      doc.text('Wings Coaching Center, Karakunnu', 105, 14, { align: 'center' });
      doc.setFontSize(11);
      doc.text('PTA Meeting Register', 105, 21, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      const formattedPtaDate = format(new Date(ptaDate), 'dd-MM-yyyy');
      doc.text(`Batch: ${pdfBatch}`, 14, 28);
      doc.text(`Date: ${formattedPtaDate}`, 105, 28, { align: 'center' });
      doc.text(`Total Students: ${studs.length}`, 196, 28, { align: 'right' });
      doc.setDrawColor(...BLACK);
      doc.setLineWidth(0.4);
      doc.line(14, 31, 196, 31);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text('Parent Attendance & Signature Sheet', 105, 36, { align: 'center' });

      // ── Table ──
      const head = [[ 'Roll No', 'Student Name', 'Parent / Guardian Name', 'Signature' ]];
      const body = studs.map(s => [
        s.roll_number || '—',
        s.name,
        '',
        ''
      ]);

      (doc as any).autoTable({
        startY: 39,
        head,
        body,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4, textColor: [...BLACK] },
        headStyles: { fillColor: [...BLACK], textColor: [...WHITE], fontStyle: 'bold', fontSize: 9 },
        columnStyles: {
          0: { cellWidth: 18, halign: 'center' },
          1: { cellWidth: 55 },
          2: { cellWidth: 65 },
          3: { cellWidth: 44 },
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        tableLineColor: [...BLACK],
        tableLineWidth: 0.3,
        rowPageBreak: 'avoid',
      });

      // ── Footer ──
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setDrawColor(...DARK);
      doc.setLineWidth(0.3);
      (doc as any).setLineDash([0.5, 1.5]);
      doc.line(14, finalY + 8, 90, finalY + 8);
      doc.line(110, finalY + 8, 196, finalY + 8);
      (doc as any).setLineDash([]);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...DARK);
      doc.text('Class Teacher Sign', 14, finalY + 12);
      doc.text('Principal Sign', 110, finalY + 12);
      doc.setFontSize(7.5);
      doc.text(`Present Parents: _______ | Absent Parents: _______`, 105, finalY + 18, { align: 'center' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(...LIGHT);
      doc.text(`Generated: ${format(new Date(), 'dd-MM-yyyy')}`, 196, finalY + 22, { align: 'right' });

      doc.save(`PTA_Register_${pdfBatch}_${formattedPtaDate}.pdf`);
      toast.success('✅ PTA Register Downloaded!');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed: ' + err.message);
    } finally {
      setGeneratingPta(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-3">
        {[
          { id: 'individual',   label: '👤 Individual View',       icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'batch',        label: '📄 Batch Score Cards',      icon: <Award className="h-4 w-4" /> },
          { id: 'consolidated', label: '📊 Consolidated Report',    icon: <BarChart2 className="h-4 w-4" /> },
          { id: 'pta',          label: '🤝 PTA Register',           icon: <Users className="h-4 w-4" /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setViewMode(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              viewMode === t.id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Individual View ── */}
      {viewMode === 'individual' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Filters */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-fit space-y-4">
            <h3 className="font-black text-slate-800 text-lg">Filter</h3>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Batch</label>
              <div className="relative mt-1">
                <select
                  className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 appearance-none font-semibold"
                  value={selBatch} onChange={e => setSelBatch(e.target.value)}
                >
                  {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="relative">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Student</label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text" value={searchName}
                  onFocus={() => setIsSearching(true)}
                  onChange={e => { setSearchName(e.target.value); setIsSearching(true); setSelectedStudentId(null); }}
                  className={`w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none uppercase placeholder:normal-case ${selectedStudentId ? 'border-green-400 bg-green-50' : 'focus:ring-2 focus:ring-indigo-100'}`}
                  placeholder="Type name..."
                />
                {selectedStudentId && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />}
              </div>
              {isSearching && searchName && !selectedStudentId && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                  {filteredSuggestions.map(s => (
                    <div key={s.id}
                      onClick={() => { setSearchName(s.name); setSelectedStudentId(s.id); setIsSearching(false); }}
                      className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer text-sm text-slate-700 uppercase font-medium"
                    >{s.name}</div>
                  ))}
                  {filteredSuggestions.length === 0 && <div className="px-4 py-3 text-sm text-slate-400 text-center">No match</div>}
                </div>
              )}
              {isSearching && <div className="fixed inset-0 z-40" onClick={() => setIsSearching(false)} />}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">From</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="w-full mt-1 p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">To</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="w-full mt-1 p-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
              </div>
            </div>

            <button onClick={handleLoadStudentReport} disabled={loadingStudent || !selectedStudentId}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              <BarChart2 className="h-4 w-4" />
              {loadingStudent ? 'Loading...' : 'Generate Report'}
            </button>
          </div>

          {/* Report Display */}
          <div className="lg:col-span-2 space-y-4">
            {studentReport ? (
              <>
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl p-6">
                  <h2 className="text-2xl font-black uppercase">{studentReport.student?.name}</h2>
                  <p className="text-indigo-200 text-sm mt-1">Batch {studentReport.student?.batch} · Roll {studentReport.student?.roll_number || '—'}</p>
                  <div className="flex gap-6 mt-5">
                    <div>
                      <p className="text-indigo-300 text-xs uppercase font-bold tracking-widest">Present</p>
                      <p className="text-3xl font-black text-green-300">{studentReport.presentDays}</p>
                    </div>
                    <div>
                      <p className="text-indigo-300 text-xs uppercase font-bold tracking-widest">Absent</p>
                      <p className="text-3xl font-black text-red-300">{studentReport.totalDays - studentReport.presentDays}</p>
                    </div>
                    <div>
                      <p className="text-indigo-300 text-xs uppercase font-bold tracking-widest">Attendance</p>
                      <p className={`text-3xl font-black ${studentReport.pct >= 75 ? 'text-green-300' : studentReport.pct >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>
                        {studentReport.pct}%
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 bg-white/20 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${studentReport.pct >= 75 ? 'bg-green-400' : studentReport.pct >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${studentReport.pct}%` }}
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
                    <Award className="h-5 w-5 text-indigo-400" />
                    <h3 className="font-black text-slate-800">Exam Scores ({studentReport.examScores.length})</h3>
                  </div>
                  {studentReport.examScores.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 font-medium">No exams recorded in this period</div>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {studentReport.examScores.map((es: any) => {
                        const max = es.exams?.max_marks || 100;
                        const isAbsent = es.is_absent;
                        const score = es.score;
                        const p = isAbsent || score === null ? 0 : Math.round((score / max) * 100);
                        const grade = getPRGrade(p, es.exams?.batch || selBatch);
                        return (
                          <div key={es.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50">
                            <div>
                              <p className="font-bold text-slate-800">{es.exams?.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {es.exams?.subject ? `${es.exams.subject} · ` : ''}{es.exams?.exam_date}
                              </p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-black text-slate-800 text-lg">{isAbsent ? '—' : `${score ?? '—'}/${max}`}</p>
                                <p className="text-xs text-slate-500">{isAbsent ? 'Absent' : `${p}%`}</p>
                              </div>
                              <span className={`w-11 h-11 rounded-xl font-black text-sm flex items-center justify-center border ${grade.bg} ${grade.color} ${grade.border}`}>
                                {isAbsent ? 'AB' : grade.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-20 text-center">
                <TrendingUp className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-medium">Select a student and generate report</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Batch PDF ── */}
      {viewMode === 'batch' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Batch Progress Report PDF</h2>
              <p className="text-slate-500 text-sm">A4 Landscape · 4 × A6 cards per sheet · Black &amp; White · Print-ready</p>
            </div>
          </div>

          {/* Row 1: Batch + Report Title */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Batch</label>
              <div className="relative">
                <select value={pdfBatch} onChange={e => setPdfBatch(e.target.value)}
                  className="w-full pl-4 pr-8 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 font-semibold appearance-none">
                  {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Report Title</label>
              <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)}
                placeholder="e.g. First Term Examination 2026"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-semibold" />
              <p className="text-[11px] text-slate-400 mt-1">Prints exactly as typed. Defaults to "Progress Report" if empty.</p>
            </div>
          </div>

          {/* Row 2: Attendance Date Range */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Attendance Period</label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">From Date</label>
                <input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-semibold" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">To Date</label>
                <input type="date" value={pdfTo} onChange={e => setPdfTo(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-semibold" />
              </div>
            </div>
          </div>

          {/* Row 3: Exam / Subject Selection */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Select Exams to Include on Scorecard
                <span className="ml-2 text-indigo-500">({selectedExamIds.length} / {availableExams.length} selected)</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSelectedExamIds(availableExams.map(e => e.id))}
                  className="text-xs text-indigo-600 font-bold hover:underline">Select All</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={() => setSelectedExamIds([])}
                  className="text-xs text-slate-400 font-bold hover:underline">Clear</button>
              </div>
            </div>
            {loadingExams ? (
              <div className="p-4 text-center text-slate-400 text-sm animate-pulse">Loading exams...</div>
            ) : availableExams.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">No exams found for batch {pdfBatch}</div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                {availableExams.map(exam => {
                  const isChecked = selectedExamIds.includes(exam.id);
                  return (
                    <label key={exam.id}
                      className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${
                        isChecked ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'
                      }`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedExamIds(prev =>
                            isChecked ? prev.filter(id => id !== exam.id) : [...prev, exam.id]
                          );
                        }}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">
                          {exam.subject ? exam.subject : exam.title}
                        </p>
                        {exam.subject && <p className="text-xs text-slate-400 truncate">{exam.title}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-slate-500">{exam.exam_date}</p>
                        <p className="text-[11px] text-slate-400">Max {exam.max_marks}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview card mockup */}
          <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/40" />
              PDF Preview — A4 Landscape (297×210mm) · 4 A6 cards per page (2×2)
            </div>
            <div className="bg-slate-50 p-3 grid grid-cols-2 gap-1">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="border border-dashed border-slate-300 rounded p-2 text-center text-[10px] text-slate-400 space-y-1">
                  <div className="font-bold text-slate-700 text-xs">Wings Coaching Center</div>
                  <div className="text-slate-500" style={{fontSize:'9px'}}>Karakunnu | {reportTitle || 'Progress Report'}</div>
                  <div className="h-px bg-slate-300 my-1" />
                  <div className="grid grid-cols-4 gap-0.5 text-[8px]">
                    <div className="col-span-2 bg-slate-200 rounded h-2" />
                    <div className="bg-slate-200 rounded h-2" />
                    <div className="bg-slate-200 rounded h-2" />
                    {[...Array(8)].map((_, r) => (
                      <React.Fragment key={r}>
                        <div className="col-span-2 bg-slate-100 rounded h-1.5" />
                        <div className="bg-slate-100 rounded h-1.5" />
                        <div className="bg-slate-100 rounded h-1.5" />
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-0.5 mt-1">
                    <div className="bg-slate-100 rounded h-2" />
                    <div className="bg-slate-100 rounded h-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-sm text-slate-600 font-medium">
            🖨️ <strong>Print tip:</strong> Print in <strong>A4 Landscape, B&amp;W</strong>. Cut along the dashed lines (vertical + horizontal) to get 4 individual A6 progress cards per sheet.
          </div>

          <button
            onClick={generateBatchPDF}
            disabled={generatingPdf || !pdfBatch}
            className="flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-black text-white font-bold rounded-xl shadow-lg shadow-slate-300 transition-all disabled:opacity-50 disabled:shadow-none text-base"
          >
            <FileDown className="h-5 w-5" />
            {generatingPdf ? 'Generating PDF...' : 'Download Batch Progress PDF'}
          </button>
        </div>
      )}

      {/* ── Consolidated Report ── */}
      {viewMode === 'consolidated' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-indigo-700 rounded-xl flex items-center justify-center">
              <BarChart2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Consolidated Marks Report</h2>
              <p className="text-slate-500 text-sm">A4 Portrait · All students ranked by total marks · Print-ready</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Batch</label>
              <div className="relative">
                <select value={pdfBatch} onChange={e => setPdfBatch(e.target.value)}
                  className="w-full pl-4 pr-8 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-100 font-semibold appearance-none">
                  {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Exam / Report Title</label>
              <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)}
                placeholder="e.g. First Terminal Examination"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-semibold" />
            </div>
          </div>

          {/* Exam Checklist (reused) */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Select Exams (each becomes a column)
                <span className="ml-2 text-indigo-500">({selectedExamIds.length}/{availableExams.length})</span>
              </label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setSelectedExamIds(availableExams.map(e => e.id))}
                  className="text-xs text-indigo-600 font-bold hover:underline">All</button>
                <span className="text-slate-300">|</span>
                <button type="button" onClick={() => setSelectedExamIds([])}
                  className="text-xs text-slate-400 font-bold hover:underline">Clear</button>
              </div>
            </div>
            {loadingExams ? (
              <div className="p-4 text-center text-slate-400 text-sm animate-pulse">Loading exams...</div>
            ) : availableExams.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-sm border border-dashed border-slate-200 rounded-xl">No exams for batch {pdfBatch}</div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {availableExams.map(exam => {
                  const isChecked = selectedExamIds.includes(exam.id);
                  return (
                    <label key={exam.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer border-b border-slate-50 last:border-0 transition-colors ${isChecked ? 'bg-indigo-50' : 'bg-white hover:bg-slate-50'}`}>
                      <input type="checkbox" checked={isChecked}
                        onChange={() => setSelectedExamIds(prev => isChecked ? prev.filter(id => id !== exam.id) : [...prev, exam.id])}
                        className="w-4 h-4 rounded accent-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-800 truncate">{exam.subject || exam.title}</p>
                        {exam.subject && <p className="text-xs text-slate-400 truncate">{exam.title}</p>}
                      </div>
                      <p className="text-xs font-bold text-slate-500 shrink-0">Max {exam.max_marks}</p>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-6 text-sm text-indigo-700 font-medium">
            📊 Students sorted by <strong>Total Marks — highest to lowest (Rank 1 = top scorer)</strong>. No grade column.
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={generateConsolidatedPDF} disabled={generatingConsolidated || !pdfBatch || selectedExamIds.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 disabled:shadow-none text-sm md:text-base flex-1">
              <FileDown className="h-5 w-5" />
              {generatingConsolidated ? 'Generating PDF...' : 'Download Consolidated PDF'}
            </button>
            <button onClick={generateConsolidatedExcel} disabled={generatingConsolidatedExcel || !pdfBatch || selectedExamIds.length === 0}
              className="flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:shadow-none text-sm md:text-base flex-1">
              <FileSpreadsheet className="h-5 w-5" />
              {generatingConsolidatedExcel ? 'Generating Excel...' : 'Download Consolidated Excel'}
            </button>
          </div>
        </div>
      )}

      {/* ── PTA Register ── */}
      {viewMode === 'pta' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">PTA Meeting Register</h2>
              <p className="text-slate-500 text-sm">A4 Portrait · Parent name + signature sheet · Print-ready</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Batch</label>
              <div className="relative">
                <select value={pdfBatch} onChange={e => setPdfBatch(e.target.value)}
                  className="w-full pl-4 pr-8 py-3 border border-slate-200 rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-emerald-100 font-semibold appearance-none">
                  {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Meeting Date</label>
              <input type="date" value={ptaDate} onChange={e => setPtaDate(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-100 font-semibold" />
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 mb-6 text-sm text-emerald-800 font-medium">
            🤝 Generates a register with student names pre-filled. Columns for <strong>Parent/Guardian Name</strong> and <strong>Signature</strong> are left blank for parents to fill in during the PTA meeting.
          </div>

          <button onClick={generatePTARegister} disabled={generatingPta || !pdfBatch}
            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-50 disabled:shadow-none text-base">
            <FileDown className="h-5 w-5" />
            {generatingPta ? 'Generating...' : 'Download PTA Register'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Reports;
