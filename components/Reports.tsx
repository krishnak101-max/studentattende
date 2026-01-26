import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parse } from 'date-fns';
import { supabase } from '../services/supabase';
import { BATCHES, StudentStats } from '../types';
import { FileDown, Search, FileText, ChevronDown, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const Reports = () => {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');

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
      </div>

      {activeTab === 'individual' ? <IndividualReport /> : <BatchPDFReport />}
    </div>
  );
};

const IndividualReport = () => {
  const [selectedBatch, setSelectedBatch] = useState(BATCHES[0]);
  const [batchStudents, setBatchStudents] = useState<{ id: string, name: string }[]>([]);
  const [searchName, setSearchName] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const [fromDate, setFromDate] = useState(format(new Date().setDate(new Date().getDate() - 30), 'dd-MM-yyyy'));
  const [toDate, setToDate] = useState(format(new Date(), 'dd-MM-yyyy'));
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(false);

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
  const [batch, setBatch] = useState(BATCHES[0]);
  const [date, setDate] = useState(format(new Date(), 'dd-MM-yyyy'));
  const [generating, setGenerating] = useState(false);

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

      // Sort: Female -> Male, then Alphabetical
      students.sort((a, b) => {
        if (a.sex !== b.sex) return a.sex === 'Female' ? -1 : 1;
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

export default Reports;