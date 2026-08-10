import React, { useState } from 'react';
import { AlertTriangle, Trash2, Shield, Download, Lock, CheckCircle2, Unlock, Plus, Eye, EyeOff, FileText, Calendar, ClipboardCopy, Users, History, ArrowRight, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useBatches } from '../context/BatchContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import Papa from 'papaparse';

const AdminTools = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [storedPassword, setStoredPassword] = useState('');
  const [alumniCount, setAlumniCount] = useState(0);
  const [allStudentsData, setAllStudentsData] = useState<any[]>([]);

  // Batch Management
  const { batches, refreshBatches } = useBatches();

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchAlumniCount();
      fetchAllStudents();
    }
  }, [isAuthenticated, batches]);
  const [newBatchName, setNewBatchName] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  // Registration Report
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportBatch, setReportBatch] = useState('ALL');
  const [reportLoading, setReportLoading] = useState(false);

  // Attendance Sheet
  const [sheetBatch, setSheetBatch] = useState('');
  const [sheetMonth, setSheetMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [sheetLoading, setSheetLoading] = useState(false);

  // Student List Excel Export
  const [exportBatch, setExportBatch] = useState('ALL');
  const [exportLoading, setExportLoading] = useState(false);

  const fetchAllStudents = async () => {
    try {
      const { data } = await supabase.from('students').select('*').neq('batch', 'ALUMNI');
      if (data) setAllStudentsData(data);
    } catch (err) {
      console.error('Failed to fetch all students');
    }
  };

  const fetchAlumniCount = async () => {
    try {
      const { count, error } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('batch', 'ALUMNI');
      
      if (!error) setAlumniCount(count || 0);
    } catch (err) {
      console.error('Failed to fetch alumni count');
    }
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'wings2026') {
      setIsAuthenticated(true);
      setStoredPassword(passwordInput);
      toast.success("Admin Panel Unlocked");
    } else {
      toast.error("Incorrect Admin Password");
      setPasswordInput('');
    }
  };

  const performSecureAction = async (actionType: 'CLEAR_ATTENDANCE' | 'FULL_RESET') => {
    // We use the stored password from the login step
    if (!storedPassword) {
      toast.error("Session expired. Please unlock again.");
      setIsAuthenticated(false);
      return;
    }

    if (actionType === 'FULL_RESET') {
      const confirmText = prompt("FINAL CHECK: This will WIPE EVERYTHING.\nType 'DELETE' to confirm:");
      if (confirmText !== 'DELETE') {
        toast.error("Action cancelled.");
        return;
      }
    } else {
      if (!confirm("Are you sure you want to delete all attendance records?")) return;
    }

    setIsLoading(true);
    try {
      let rpcName = actionType === 'CLEAR_ATTENDANCE' ? 'clear_all_attendance' : 'reset_full_system';

      // Call the Secure RPC with the stored password
      const { error } = await supabase.rpc(rpcName, { password_attempt: storedPassword });

      if (error) {
        if (error.message.includes('Invalid Admin Password')) {
          toast.error("Security Check Failed: Invalid Password");
          setIsAuthenticated(false); // Force re-login
        } else {
          throw error;
        }
      } else {
        toast.success(actionType === 'CLEAR_ATTENDANCE' ? 'Attendance Cleared Successfully' : 'System Fully Reset');
      }
    } catch (error: any) {
      console.error(error);
      toast.error('Operation Failed: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const { data: students, error: sErr } = await supabase.from('students').select('*');
      const { data: attendance, error: aErr } = await supabase.from('attendance').select('*');

      if (sErr || aErr) throw new Error("Failed to fetch data for backup");

      const backupData = {
        timestamp: new Date().toISOString(),
        students,
        attendance
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `WINGS_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Backup Downloaded");
    } catch (error) {
      toast.error("Backup failed");
      console.error(error);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleAddBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBatchName.trim()) return;
    setBatchLoading(true);
    try {
      const { error } = await supabase.from('batches').insert([{ name: newBatchName.toUpperCase(), is_active: true }]);
      if (error) throw error;
      toast.success("Batch created!");
      setNewBatchName('');
      await refreshBatches();
    } catch (err: any) {
      toast.error('Failed to create batch: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleBatch = async (id: string, currentStatus: boolean) => {
    setBatchLoading(true);
    try {
      const { error } = await supabase.from('batches').update({ is_active: !currentStatus }).eq('id', id);
      if (error) throw error;
      toast.success(currentStatus ? "Batch hidden" : "Batch visible");
      await refreshBatches();
    } catch (err: any) {
      toast.error('Failed to toggle batch visibility');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleGenerateRegistrationReport = async () => {
    setReportLoading(true);
    try {
      // created_at is timestamp with timezone. We can query by checking if it starts with the report date.
      // or using greater than and less than
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

      if (!data || data.length === 0) {
        toast.error(`No students registered on ${reportDate} ${reportBatch !== 'ALL' ? 'for ' + reportBatch : ''}`);
        return;
      }

      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("New Registrations Report", 14, 20);
      doc.setFontSize(11);
      doc.text(`Date: ${reportDate}`, 14, 28);
      doc.text(`Batch: ${reportBatch}`, 14, 34);
      doc.text(`Total Registrations: ${data.length}`, 14, 40);

      const tableData = data.map((s, index) => [
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
        headStyles: { fillColor: [79, 70, 229] },
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
    setReportLoading(true);
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

      if (!data || data.length === 0) {
        toast.error(`No students found for ${reportDate}`);
        return;
      }

      let message = `*New Registrations - ${reportDate}*\n\n`;
      const batchCounts: Record<string, number> = {};

      data.forEach(s => {
        batchCounts[s.batch] = (batchCounts[s.batch] || 0) + 1;
      });

      Object.entries(batchCounts).forEach(([b, count]) => {
        message += `*Batch ${b}*: ${count} student${count > 1 ? 's' : ''}\n`;
      });

      const totalCount = data.length;
      message += `\n*Total*: ${totalCount} new registration${totalCount > 1 ? 's' : ''}`;

      await navigator.clipboard.writeText(message);
      toast.success("Copied to clipboard for WhatsApp!");
    } catch (err) {
      toast.error('Failed to copy');
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleGenerateAttendanceSheet = async () => {
    if (!sheetBatch) {
      toast.error("Please select a batch");
      return;
    }
    setSheetLoading(true);
    try {
      // Get all students for the selected batch
      const { data, error } = await supabase.from('students').select('*').eq('batch', sheetBatch);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error(`No students in batch ${sheetBatch}`);
        return;
      }

      // Sort students: 
      // 1. Girls first, then Boys
      // 2. Language: Malayalam(1), Sanskrit(2), Arabic(3), Urdu(4)
      // 3. Name alphabetical
      const sortedStudents = [...data].sort((a, b) => {
        const rollA = parseInt(a.roll_number || '0', 10);
        const rollB = parseInt(b.roll_number || '0', 10);

        if (rollA > 0 && rollB > 0) {
            if (rollA !== rollB) return rollA - rollB;
        } else if (rollA > 0) {
            return -1;
        } else if (rollB > 0) {
            return 1;
        }

        if (a.sex !== b.sex) {
            return a.sex === 'Female' ? -1 : 1;
        }

        const langOrder: Record<string, number> = { 'Malayalam': 1, 'Arabic': 2, 'Sanskrit': 3, 'Urdu': 4 };
        const lA = langOrder[a.first_language || 'Malayalam'] || 99;
        const lB = langOrder[b.first_language || 'Malayalam'] || 99;
        if (lA !== lB) return lA - lB;

        return (a.name || '').localeCompare(b.name || '');
      });

      // Calculate days in the selected month
      const [yearStr, monthStr] = sheetMonth.split('-');
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const daysInMonth = new Date(year, month, 0).getDate();

      // Setup PDF in landscape A4
      const doc = new jsPDF('landscape', 'mm', 'a4');
      doc.setFontSize(14);
      doc.text(`Attendance Sheet: Batch ${sheetBatch} | ${format(new Date(year, month - 1, 1), 'MMMM yyyy')}`, 14, 15);
      
      // Header row
      const head = [['Roll', 'Name', 'Lang', ...Array.from({length: daysInMonth}, (_, i) => `${i+1}`)]];
      
      // Body rows
      const body = sortedStudents.map(s => [
        s.roll_number || '-',
        s.name,
        (s.first_language || 'Mal').substring(0, 3), // Shorten lang to 3 letters
        ...Array(daysInMonth).fill('') // Empty cells for attendance marking
      ]);

      (doc as any).autoTable({
        startY: 20,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], halign: 'center', fontSize: 8, cellPadding: 1 },
        bodyStyles: { fontSize: 8, cellPadding: 1, textColor: [40, 40, 40] },
        columnStyles: {
          0: { cellWidth: 12, fontStyle: 'bold', halign: 'center' }, // Roll
          1: { cellWidth: 46 }, // Name
          2: { cellWidth: 12, halign: 'center' }, // Lang
          // Days columns will auto-distribute
        },
        styles: { overflow: 'linebreak', minCellHeight: 6 },
        didParseCell: function(data: any) {
          if (data.section === 'body' && data.column.index > 2) {
            data.cell.styles.halign = 'center';
          }
        }
      });

      doc.save(`Attendance_Sheet_${sheetBatch}_${sheetMonth}.pdf`);
      toast.success("Attendance Sheet Generated!");
    } catch (err: any) {
      toast.error("Failed to generate sheet");
      console.error(err);
    } finally {
      setSheetLoading(false);
    }
  };

  const handleExportStudentListExcel = async () => {
    setExportLoading(true);
    try {
      let query = supabase
        .from('students')
        .select('roll_number, name, batch, sex, medium, first_language, parent_name, phone_number, school_name, register_number')
        .neq('batch', 'ALUMNI');

      if (exportBatch !== 'ALL') query = query.eq('batch', exportBatch);

      const { data: rawData, error } = await query;
      if (error) throw error;
      if (!rawData?.length) { toast.error('No students found'); return; }

      // Sort by Batch, then identical class sorting
      const data = [...rawData].sort((a, b) => {
        if (a.batch !== b.batch) return a.batch.localeCompare(b.batch);

        const rollA = parseInt(a.roll_number || '0', 10);
        const rollB = parseInt(b.roll_number || '0', 10);

        if (rollA > 0 && rollB > 0) {
            if (rollA !== rollB) return rollA - rollB;
        } else if (rollA > 0) {
            return -1;
        } else if (rollB > 0) {
            return 1;
        }

        if (a.sex !== b.sex) {
            return a.sex === 'Female' ? -1 : 1;
        }

        const langOrder: Record<string, number> = { 'Malayalam': 1, 'Arabic': 2, 'Sanskrit': 3, 'Urdu': 4 };
        const lA = langOrder[a.first_language || 'Malayalam'] || 99;
        const lB = langOrder[b.first_language || 'Malayalam'] || 99;
        if (lA !== lB) return lA - lB;

        return (a.name || '').localeCompare(b.name || '');
      });

      const csv = Papa.unparse({
        fields: ['Reg No', 'Roll No', 'Name', 'Batch', 'Sex', 'Medium', 'First Language', 'Parent Name', 'Phone Number', 'School Name'],
        data: data.map(s => [
          s.register_number || '—',
          s.roll_number     || '—',
          s.name,
          s.batch,
          s.sex,
          s.medium            || '—',
          s.first_language    || '—',
          s.parent_name       || '—',
          s.phone_number      || '—',
          s.school_name       || '—',
        ])
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Student_List_${exportBatch}_${format(new Date(), 'dd-MM-yyyy')}.csv`;
      link.click();
      toast.success(`✅ Exported ${data.length} students to Excel!`);
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
      console.error(err);
    } finally {
      setExportLoading(false);
    }
  };

  // LOCKED STATE UI
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-12 p-8 bg-white rounded-2xl shadow-lg border border-slate-100 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="h-8 w-8 text-indigo-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Admin Locked</h2>
        <p className="text-slate-500 mb-6">Enter the security password to access sensitive controls.</p>

        <form onSubmit={handleUnlock} className="space-y-4">
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter Admin Password"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-center text-lg tracking-widest"
            autoFocus
          />
          <button
            type="submit"
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Unlock className="h-4 w-4" />
            Unlock Panel
          </button>
        </form>
      </div>
    );
  }

  // UNLOCKED STATE UI
  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-600" />
          Admin & Security
        </h1>
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100 flex items-center gap-1">
            <Unlock className="h-3 w-3" /> UNLOCKED
          </div>
          <button
            onClick={() => setIsAuthenticated(false)}
            className="text-sm text-slate-400 hover:text-slate-600 underline"
          >
            Lock
          </button>
        </div>

      </div>

      {/* Alumni Status Summary */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 shadow-xl text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-indigo-400" />
              Alumni Management
            </h3>
            <p className="text-slate-400 text-sm mt-1">
              Students moved to the ALUMNI batch are hidden from dashboard and attendance.
            </p>
          </div>
          <div className="text-right">
            <span className="block text-slate-400 text-xs uppercase font-bold tracking-wider">Total Alumni</span>
            <span className="text-4xl font-black text-indigo-400">{alumniCount}</span>
          </div>
        </div>
      </div>


      {/* Backup Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-2 flex items-center gap-2">
          <Download className="h-5 w-5 text-green-600" />
          Backup Data
        </h3>
        <p className="text-slate-500 mb-4 text-sm">
          Download a full copy of your database (Students + Attendance).
          Save this file to your <b>Google Drive</b> or <b>Email</b> regularly to prevent data loss.
        </p>
        <button
          onClick={handleBackup}
          disabled={backupLoading}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-bold shadow-md shadow-green-100"
        >
          {backupLoading ? 'Downloading...' : 'Download Full Backup'}
        </button>
      </div>

      {/* Batch Management Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-600" />
          Batch Management
        </h3>
        <form onSubmit={handleAddBatch} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newBatchName}
            onChange={e => setNewBatchName(e.target.value)}
            placeholder="New Batch Name (e.g. S4)"
            className="flex-1 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 uppercase"
            disabled={batchLoading}
          />
          <button
            type="submit"
            disabled={batchLoading || !newBatchName.trim()}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-slate-300"
          >
            <Plus className="h-5 w-5" />
          </button>
        </form>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {batches.map(batch => (
            <div key={batch.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 transition-colors">
              <span className="font-bold text-slate-700">{batch.name}</span>
              <button
                onClick={() => toggleBatch(batch.id, batch.is_active)}
                className={`p-1.5 rounded-full ${batch.is_active ? 'bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700' : 'bg-red-100 text-red-700 hover:bg-green-100 hover:text-green-700'}`}
                title={batch.is_active ? "Hide Batch" : "Show Batch"}
              >
                {batch.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          ))}
          {batches.length === 0 && <span className="text-slate-400 text-sm italic">No batches configured</span>}
        </div>
      </div>

      {/* Batch Statistics Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-indigo-600" />
          Batch Overview & Demographics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {batches.map(batch => {
            const bStudents = allStudentsData.filter(s => s.batch === batch.name);
            const boys = bStudents.filter(s => s.sex === 'Male').length;
            const girls = bStudents.filter(s => s.sex === 'Female').length;
            const mal = bStudents.filter(s => s.first_language === 'Malayalam' || !s.first_language).length;
            const san = bStudents.filter(s => s.first_language === 'Sanskrit').length;
            const ara = bStudents.filter(s => s.first_language === 'Arabic').length;
            const urd = bStudents.filter(s => s.first_language === 'Urdu').length;

            return (
              <div key={batch.id} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
                  <span className="font-black text-slate-800 text-lg tracking-wide">{batch.name}</span>
                  <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-bold">
                    {bStudents.length} Students
                  </span>
                </div>
                <div className="p-4 bg-white grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Gender</p>
                    <p className="text-sm font-semibold flex justify-between">Girls: <span className="text-pink-600">{girls}</span></p>
                    <p className="text-sm font-semibold flex justify-between">Boys: <span className="text-blue-600">{boys}</span></p>
                  </div>
                  <div className="space-y-1 border-l border-slate-100 pl-4">
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Language</p>
                    {mal > 0 && <p className="text-sm flex justify-between text-slate-600">Malayalam: <b>{mal}</b></p>}
                    {san > 0 && <p className="text-sm flex justify-between text-slate-600">Sanskrit: <b>{san}</b></p>}
                    {ara > 0 && <p className="text-sm flex justify-between text-slate-600">Arabic: <b>{ara}</b></p>}
                    {urd > 0 && <p className="text-sm flex justify-between text-slate-600">Urdu: <b>{urd}</b></p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Student List Excel Export */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-2 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
          Export Student List (Excel / CSV)
        </h3>
        <p className="text-slate-500 mb-4 text-sm">
          Download a full student list for any batch in Excel (CSV) format with all admission details — name, batch, sex, roll no, medium, language, parent name, phone, and school.
        </p>
        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1">Batch</label>
            <select
              value={exportBatch}
              onChange={e => setExportBatch(e.target.value)}
              className="px-4 py-2 border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-emerald-100 font-semibold"
            >
              <option value="ALL">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleExportStudentListExcel}
            disabled={exportLoading}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md shadow-emerald-100 transition-all disabled:bg-slate-300 disabled:shadow-none"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {exportLoading ? 'Exporting...' : 'Download Excel'}
          </button>
        </div>
      </div>

      {/* Attendance Sheet Generator */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-indigo-600" />
          Printable Attendance Sheets
        </h3>
        <p className="text-slate-500 mb-6 text-sm">
          Generate an A4 landscape monthly attendance sheet sorted by <b>Girls &rarr; Boys</b>, then by <b>First Language</b>, then alphabetically. Perfect for printing to take manual attendance.
        </p>
        <div className="flex flex-wrap gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 w-fit">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1">Batch</label>
            <select
              value={sheetBatch}
              onChange={e => setSheetBatch(e.target.value)}
              className="px-4 py-2 border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 font-semibold"
            >
              <option value="">Select Batch</option>
              {batches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1">Month & Year</label>
            <input
              type="month"
              value={sheetMonth}
              onChange={e => setSheetMonth(e.target.value)}
              className="px-4 py-2 border border-slate-200 bg-white rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 font-semibold"
            />
          </div>
          <button
            onClick={handleGenerateAttendanceSheet}
            disabled={sheetLoading || !sheetBatch || !sheetMonth}
            className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:shadow-none shadow-md shadow-indigo-100 transition-all flex items-center gap-2"
          >
            {sheetLoading ? 'Processing...' : <><FileText className="h-4 w-4" /> Generate Sheet</>}
          </button>
        </div>
      </div>

      {/* Registration Report Section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-700 mb-4 flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600" />
          New Student Registrations Report
        </h3>
        <p className="text-slate-500 mb-4 text-sm">
          Generate a PDF list of newly registered students by date and batch.
        </p>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Registration Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={reportDate}
                onChange={e => setReportDate(e.target.value)}
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Batch</label>
            <select
              value={reportBatch}
              onChange={e => setReportBatch(e.target.value)}
              className="px-4 py-2 border border-slate-200 rounded-lg outline-none focus:border-indigo-500 bg-white"
            >
              <option value="ALL">All Batches</option>
              {batches.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateRegistrationReport}
              disabled={reportLoading}
              className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 flex items-center gap-2"
            >
              {reportLoading ? 'Processing...' : <><Download className="h-4 w-4" /> PDF</>}
            </button>
            <button
              onClick={handleCopyForWhatsapp}
              disabled={reportLoading}
              className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:bg-slate-300 flex items-center gap-2"
              title="Copy details to paste in WhatsApp"
            >
              <ClipboardCopy className="h-4 w-4" /> WA Copy
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 border border-red-100 rounded-xl p-6 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute top-0 right-0 p-4 opacity-5">
          <Lock className="w-32 h-32" />
        </div>

        <div className="relative z-10">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-800">Danger Zone</h3>
              <p className="text-red-600/80 text-sm">
                Actions here are destructive. Handle with care.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-red-100 divide-y divide-slate-100">
            {/* Clear Attendance */}
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-700">Clear Attendance Only</h4>
                <p className="text-xs text-slate-500">Deletes all attendance records. Students remain safe.</p>
              </div>
              <button
                onClick={() => performSecureAction('CLEAR_ATTENDANCE')}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-bold"
              >
                Clear Attendance
              </button>
            </div>

            {/* Full Reset */}
            <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-red-50/50">
              <div>
                <h4 className="font-bold text-red-700">Factory Reset</h4>
                <p className="text-xs text-red-600/70">Wipes EVERYTHING. Completely irreversible.</p>
              </div>
              <button
                onClick={() => performSecureAction('FULL_RESET')}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-bold shadow-sm"
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTools;