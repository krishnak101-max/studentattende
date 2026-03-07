import React, { useState } from 'react';
import { AlertTriangle, Trash2, Shield, Download, Lock, CheckCircle2, Unlock, Plus, Eye, EyeOff, FileText, Calendar, ClipboardCopy } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useBatches } from '../context/BatchContext';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

const AdminTools = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [storedPassword, setStoredPassword] = useState('');

  // Batch Management
  const { batches, refreshBatches } = useBatches();
  const [newBatchName, setNewBatchName] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  // Registration Report
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportBatch, setReportBatch] = useState('ALL');
  const [reportLoading, setReportLoading] = useState(false);

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