import React, { useState } from 'react';
import { AlertTriangle, Trash2, Shield, Download, Lock, CheckCircle2, Unlock } from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

const AdminTools = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [storedPassword, setStoredPassword] = useState('');

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