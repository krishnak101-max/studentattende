import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { supabase } from '../services/supabase';
import toast from 'react-hot-toast';

const AdminTools = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClearAttendance = async () => {
    // Warning 1
    if (!confirm('WARNING: This will delete ALL attendance history permanently.\nStudents will remain.\n\nAre you sure?')) return;
    
    // Warning 2
    if (!confirm('FINAL CONFIRMATION:\nThis cannot be undone. Do you really want to delete all attendance records?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('clear_all_attendance');
      if (error) throw error;
      toast.success('Attendance history cleared successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed. Ensure database functions are set up.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullSystemReset = async () => {
    // Warning 1
    if (!confirm('CRITICAL WARNING: This will delete ALL Students AND Attendance data.\n\nDo you want to proceed?')) return;

    // Warning 2
    if (!confirm('FINAL WARNING: This action is irreversible.\nYour entire database will be wiped clean.\n\nAre you absolutely sure?')) return;

    // Warning 3 (Type to confirm)
    const userInput = prompt('To confirm full system reset, type "RESET" below:');
    
    if (userInput !== 'RESET') {
      if (userInput !== null) toast.error('Reset cancelled. Incorrect code.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('reset_full_system');
      if (error) throw error;
      toast.success('System completely reset.');
    } catch (error) {
      console.error(error);
      toast.error('Failed. Ensure database functions are set up.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Admin Tools</h1>
      
      <div className="bg-red-50 border border-red-100 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-full">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-red-800">Danger Zone</h3>
            <p className="text-red-600/80 mt-1 mb-6">
              These actions are irreversible. Double confirmation is required.
            </p>
            
            <div className="space-y-4">
              {/* Clear Attendance */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white rounded-lg border border-red-100 shadow-sm gap-4">
                <div>
                  <h4 className="font-bold text-slate-700">Clear Attendance Only</h4>
                  <p className="text-sm text-slate-500">Keeps students, deletes all daily records.</p>
                </div>
                <button
                  onClick={handleClearAttendance}
                  disabled={isLoading}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 bg-white border-2 border-red-100 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors font-bold disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {isLoading ? 'Processing...' : 'Clear Attendance'}
                </button>
              </div>

              {/* Full Reset */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white rounded-lg border border-red-200 shadow-sm ring-1 ring-red-100 gap-4">
                <div>
                  <h4 className="font-bold text-red-700">Full System Reset</h4>
                  <p className="text-sm text-slate-500">Deletes EVERYTHING (Students + Attendance).</p>
                </div>
                <button
                  onClick={handleFullSystemReset}
                  disabled={isLoading}
                  className="shrink-0 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold shadow-md shadow-red-200 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  {isLoading ? 'Reseting...' : 'Reset Everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTools;