import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parse } from 'date-fns';
import { supabase } from '../services/supabase';
import { StudentStats, Exam, ExamScore } from '../types';
import { useBatches } from '../context/BatchContext';
import { FileDown, Search, FileText, ChevronDown, Check, ClipboardCopy, Users, BarChart2, Award, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';

const Reports = () => {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch' | 'joins' | 'progress'>('individual');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Reports & Analytics</h1>

      <div className="flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'individual'
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Individual Report
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'batch'
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          Daily Batch PDF
        </button>
        <button
          onClick={() => setActiveTab('joins')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'joins'
            ? 'border-primary text-primary'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          New Joins
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'progress'
            ? 'border-indigo-600 text-indigo-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <BarChart2 className="h-4 w-4" />
          Progress Report
        </button>
      </div>

      {activeTab === 'individual' && <IndividualReport />}
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
  const [viewMode, setViewMode] = useState<'individual' | 'batch'>('individual');

  useEffect(() => {
    if (BATCHES.length > 0) {
      if (!selBatch) setSelBatch(BATCHES[0]);
      if (!pdfBatch) setPdfBatch(BATCHES[0]);
    }
  }, [BATCHES]);

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

      const { data: allExams } = await supabase.from('exams').select('*')
        .eq('batch', pdfBatch).gte('exam_date', pdfFrom).lte('exam_date', pdfTo)
        .order('exam_date');

      // Fetch exam scores with pagination
      let allScores: any[] = [];
      const examIds = (allExams || []).map(e => e.id);
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

      // A4 Landscape: 297 × 210 mm  |  Each A5 card: ~148 × 210 mm
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PAGE_W = 297;
      const PAGE_H = 210;
      const CARD_W = 148;   // exactly half of A4 landscape = A5
      const CARD_H = 210;
      const PAD = 6;        // inner padding

      // ── B&W colour constants ──
      const BLACK  = [0, 0, 0]         as [number, number, number];
      const DARK   = [20, 20, 20]      as [number, number, number];
      const MID    = [80, 80, 80]      as [number, number, number];
      const LIGHT  = [160, 160, 160]   as [number, number, number];
      const XLIGHT = [230, 230, 230]   as [number, number, number];
      const WHITE  = [255, 255, 255]   as [number, number, number];

      const drawCard = (student: any, x: number) => {
        const y = 0;
        const iw = CARD_W - PAD * 2;   // inner width

        // ── outer border ──
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.8);
        doc.rect(x, y, CARD_W, CARD_H);

        // ── HEADER BLOCK ──
        const hdrH = 32;

        // thin decorative line inside header
        doc.setDrawColor(...BLACK);
        doc.setLineWidth(0.3);
        doc.line(x + PAD, y + hdrH - 5, x + CARD_W - PAD, y + hdrH - 5);

        // Title
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...BLACK);
        doc.text('Wings Coaching Center', x + CARD_W / 2, y + 12, { align: 'center' });

        // Subtitle 1
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...DARK);
        doc.text('Karakunnu', x + CARD_W / 2, y + 18, { align: 'center' });

        // Subtitle 2
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...BLACK);
        const repTitleStr = reportTitle ? `${reportTitle} Progress Report` : 'Progress Report';
        doc.text(repTitleStr, x + CARD_W / 2, y + 25, { align: 'center' });

        // ── STUDENT INFO ──
        let curY = hdrH + 7;

        // Name row with batch badge
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(...DARK);
        doc.text(student.name.toUpperCase(), x + PAD, curY + 4);

        // Batch badge (right aligned)
        const batchLabel = student.batch;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setFillColor(...DARK);
        doc.setTextColor(...WHITE);
        const bW = batchLabel.length * 3.5 + 8;
        doc.roundedRect(x + CARD_W - PAD - bW, curY - 2, bW, 8, 1.5, 1.5, 'F');
        doc.text(batchLabel, x + CARD_W - PAD - bW / 2, curY + 3.8, { align: 'center' });

        curY += 9;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...MID);
        const rollSex = `Roll No: ${student.roll_number || '—'}   ${student.sex ? `| ${student.sex}` : ''}`;
        doc.text(rollSex, x + PAD, curY);

        curY += 4;

        // Period line
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(...LIGHT);
        doc.text(`Period: ${pdfFrom} to ${pdfTo}`, x + PAD, curY);

        curY += 5;

        // Thin separator
        doc.setDrawColor(...XLIGHT);
        doc.setLineWidth(0.4);
        doc.line(x + PAD, curY, x + CARD_W - PAD, curY);
        curY += 5;

        // ── ATTENDANCE SECTION ──
        const attForStudent = (allAttendance || []).filter(a => {
          if (a.student_id !== student.id) return false;
          const d = a.date.split('-').reverse().join('-');
          return d >= pdfFrom && d <= pdfTo;
        });
        const presentDays = attForStudent.filter(a => a.status === 'Present').length;
        const totalDays = attForStudent.length;
        const attPct = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

        // Section heading
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK);
        doc.text('ATTENDANCE', x + PAD, curY + 4);

        // Stats (right)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const attStr = `${attPct}%`;
        if (attPct >= 75) doc.setTextColor(...BLACK);
        else doc.setTextColor(...LIGHT);
        doc.text(attStr, x + CARD_W - PAD, curY + 4, { align: 'right' });

        curY += 8;

        // Attendance bar
        const barW = iw;
        const barH = 5;
        doc.setFillColor(...XLIGHT);
        doc.roundedRect(x + PAD, curY, barW, barH, 1.2, 1.2, 'F');
        if (attPct > 0) {
          const fill = Math.max((barW * attPct) / 100, 3);
          doc.setFillColor(...DARK);
          doc.roundedRect(x + PAD, curY, fill, barH, 1.2, 1.2, 'F');
        }

        curY += barH + 4;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...MID);
        doc.text(`${presentDays} Present  /  ${totalDays - presentDays} Absent  /  ${totalDays} Total Days`, x + PAD, curY);
        curY += 5;

        // Separator
        doc.setDrawColor(...XLIGHT);
        doc.setLineWidth(0.4);
        doc.line(x + PAD, curY, x + CARD_W - PAD, curY);
        curY += 5;

        // ── EXAM SCORES ──
        const studentScores = (allScores || []).filter(sc => sc.student_id === student.id);
        const examsData = (allExams || []).map(ex => ({
          exam: ex,
          score: studentScores.find(s => s.exam_id === ex.id),
        }));

        // Section heading row
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(...DARK);
        doc.text('EXAM SCORES', x + PAD, curY + 4);

        // Column headers
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(...MID);
        doc.text('Subject', x + PAD, curY + 10);
        doc.text('Score', x + PAD + iw * 0.76, curY + 10, { align: 'right' });
        doc.text('Grade', x + CARD_W - PAD, curY + 10, { align: 'right' });

        curY += 13;
        doc.setDrawColor(...XLIGHT);
        doc.setLineWidth(0.3);
        doc.line(x + PAD, curY - 1, x + CARD_W - PAD, curY - 1);

        if (examsData.length === 0) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7);
          doc.setTextColor(...LIGHT);
          doc.text('No exams in this period', x + CARD_W / 2, curY + 6, { align: 'center' });
          curY += 14;
        } else {
          const maxRows = Math.min(examsData.length, 7);
          examsData.slice(0, maxRows).forEach((es, i) => {
            const rowH = 8;
            const rowY = curY + i * rowH;

            // Alternating row bg
            if (i % 2 === 0) {
              doc.setFillColor(...XLIGHT);
              doc.rect(x + PAD - 1, rowY - 1.5, iw + 2, rowH, 'F');
            }

            const isAbsent = es.score?.is_absent;
            const rawScore = es.score?.score;
            const max = es.exam.max_marks;
            const scorePct = isAbsent || rawScore === null || rawScore === undefined
              ? 0 : Math.round((rawScore / max) * 100);
            const gradeLabel = isAbsent ? 'AB' : getPRGradeLabel(scorePct, pdfBatch);

            // Exam title
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(...DARK);
            const title = es.exam.subject ? es.exam.subject : (es.exam.title.length > 28 ? es.exam.title.substring(0, 28) + '…' : es.exam.title);
            doc.text(title, x + PAD, rowY + 4.5);

            // Score
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            const scoreText = isAbsent ? 'AB' : (rawScore !== null && rawScore !== undefined ? `${rawScore}/${max}` : '—');
            if (isAbsent) doc.setTextColor(...LIGHT); else doc.setTextColor(...DARK);
            doc.text(scoreText, x + PAD + iw * 0.76, rowY + 4.5, { align: 'right' });

            // Grade — bold, black
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(...DARK);
            doc.text(gradeLabel, x + CARD_W - PAD, rowY + 4.5, { align: 'right' });
          });

          if (examsData.length > maxRows) {
            const moreY = curY + maxRows * 8 + 3;
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(6.5);
            doc.setTextColor(...LIGHT);
            doc.text(`+ ${examsData.length - maxRows} more exams…`, x + PAD, moreY);
          }
        }

        // ── FOOTER ──
        const footY = CARD_H - 8;
        doc.setDrawColor(...XLIGHT);
        doc.setLineWidth(0.4);
        doc.line(x + PAD, footY - 2, x + CARD_W - PAD, footY - 2);

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6);
        doc.setTextColor(...LIGHT);
        doc.text(`Generated: ${format(new Date(), 'dd-MM-yyyy')}`, x + PAD, footY + 2);
        doc.setTextColor(...DARK);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('Wings Coaching Center, Karakunnu', x + CARD_W - PAD, footY + 2, { align: 'right' });
      };

      // ── RENDER PAGES ──
      for (let i = 0; i < studs.length; i++) {
        const col = i % 2;
        if (col === 0 && i > 0) doc.addPage();

        const xPos = col === 0 ? 0 : CARD_W;
        drawCard(studs[i], xPos);

        // Dashed cut guide between the two cards
        if (col === 0 && i + 1 < studs.length) {
          doc.setDrawColor(...XLIGHT);
          doc.setLineWidth(0.25);
          (doc as any).setLineDash([3, 3]);
          doc.line(CARD_W, 3, CARD_W, PAGE_H - 3);
          (doc as any).setLineDash([]);

          // Scissor icon hint
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5);
          doc.setTextColor(...LIGHT);
          doc.text('✂ cut', CARD_W, 2, { align: 'center' });
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

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-3">
        {[
          { id: 'individual', label: '👤 Individual View',  icon: <TrendingUp className="h-4 w-4" /> },
          { id: 'batch',      label: '📄 Batch PDF (A5×2)', icon: <Award className="h-4 w-4" /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setViewMode(t.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
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
              <p className="text-slate-500 text-sm">A4 Landscape · 2 × A5 cards per sheet · Black &amp; White · Print-ready</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Exam Title</label>
              <input type="text" value={reportTitle} onChange={e => setReportTitle(e.target.value)} placeholder="(Optional) e.g. Unit Test"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">From Date</label>
              <input type="date" value={pdfFrom} onChange={e => setPdfFrom(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-semibold" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">To Date</label>
              <input type="date" value={pdfTo} onChange={e => setPdfTo(e.target.value)}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-100 font-semibold" />
            </div>
          </div>

          {/* Preview card mockup */}
          <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-white/40" />
              PDF Preview — A4 Landscape (297×210mm) · 2 A5 cards per page
            </div>
            <div className="bg-slate-50 p-4 flex gap-2 items-stretch">
              {[1, 2].map(i => (
                <div key={i} className="flex-1 border-2 border-dashed border-slate-300 rounded-lg p-3 text-center text-xs text-slate-400 space-y-1.5">
                  <div className="text-slate-800 text-center py-2 rounded font-bold text-sm">Wings Coaching Center</div>
                  <div className="text-slate-700 font-bold">Karakunnu</div>
                  <div className="text-slate-800 font-bold">{reportTitle ? `${reportTitle} Progress Report` : 'Progress Report'}</div>
                  <div className="h-px bg-slate-400 my-1" />
                  <div className="text-left space-y-1">
                    <div className="h-2 bg-slate-200 rounded w-4/5" />
                    <div className="h-2 bg-slate-200 rounded w-2/5" />
                  </div>
                  <div className="h-2.5 bg-slate-300 rounded-full w-full mt-2" />
                  <div className="text-slate-400 text-[10px] mt-1">Exam scores table…</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-sm text-slate-600 font-medium">
            🖨️ <strong>Print tip:</strong> Print in <strong>A4 Landscape, B&amp;W</strong>. Cut along the dashed centre line to get individual A5 progress cards for each student.
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
    </div>
  );
};

export default Reports;
