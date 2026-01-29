import React, { useState } from 'react';
import { AlertTriangle, Trash2, Shield, Download, Lock, CheckCircle2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

const AdminTools = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  const performSecureAction = async (actionType: 'CLEAR_ATTENDANCE' | 'FULL_RESET') => {
    // 1. Ask for Password
    const password = prompt("Enter Admin Password to proceed with this critical action:");

    if (!password) {
      toast.error("Password required");
      return;
    }

    // 2. Local Check (Optional, for instant feedback) - The real check is in the DB
    if (password !== 'wings2026') {
      toast.error("Incorrect Password!");
      return;
    }

    if (actionType === 'FULL_RESET') {
      const confirmText = prompt("FINAL CHECK: This will WIPE EVERYTHING.\nType 'DELETE' to confirm:");
      if (confirmText !== 'DELETE') {
        toast.error("Action cancelled.");
        return;
      }
    }

    setIsLoading(true);
    try {
      let rpcName = actionType === 'CLEAR_ATTENDANCE' ? 'clear_all_attendance' : 'reset_full_system';

      // Call the Secure RPC with password
      const { error } = await supabase.rpc(rpcName, { password_attempt: password });

      if (error) {
        // Handle custom SQL errors
        if (error.message.includes('Invalid Admin Password')) {
          toast.error("Server Rejected: Invalid Password");
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
      // Fetch all data
      const { data: students, error: sErr } = await supabase.from('students').select('*');
      const { data: attendance, error: aErr } = await supabase.from('attendance').select('*');

      if (sErr || aErr) throw new Error("Failed to fetch data for backup");

      const backupData = {
        timestamp: new Date().toISOString(),
        students,
        attendance
      };

      // Create JSON Blob
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `WINGS_BACKUP_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Backup Downloaded! Save this file safely.");

    } catch (error) {
      toast.error("Backup failed");
      console.error(error);
    } finally {
      setBackupLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Shield className="h-6 w-6 text-indigo-600" />
          Admin & Security
        </h1>
        <div className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold border border-indigo-100">
          SECURED
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
                Actions here are destructive and require the <b>Admin Password</b>.
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