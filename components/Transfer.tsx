import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useBatches } from '../context/BatchContext';
import { History, ArrowRight, CheckCircle2, AlertCircle, Users, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';

const Transfer = () => {
  const { batches, refreshBatches } = useBatches();
  
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMode, setTransferMode] = useState<'BULK' | 'SINGLE'>('BULK');
  const [transferStudentId, setTransferStudentId] = useState('');
  const [studentsInFromBatch, setStudentsInFromBatch] = useState<any[]>([]);
  const [alumniCount, setAlumniCount] = useState(0);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [transferredInfo, setTransferredInfo] = useState<{name: string, to: string} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, title: string} | null>(null);

  useEffect(() => {
    fetchAlumniCount();
  }, [batches]);

  // Fetch students when transferFrom changes in SINGLE mode
  useEffect(() => {
    if (transferFrom && transferMode === 'SINGLE') {
      fetchStudentsForBatch();
    } else {
      setStudentsInFromBatch([]);
      setTransferStudentId('');
    }
  }, [transferFrom, transferMode]);

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

  const fetchStudentsForBatch = async () => {
    try {
      const { data, error } = await supabase
        .from('students')
        .select('id, name, roll_number')
        .eq('batch', transferFrom)
        .order('name');
      
      if (!error) setStudentsInFromBatch(data || []);
    } catch (err) {
      console.error('Failed to fetch students for batch');
    }
  };

  const handleTransferClick = () => {
    if (!transferFrom || !transferTo) return;
    if (transferFrom === transferTo) {
      toast.error("Source and destination batches are the same");
      return;
    }

    if (transferMode === 'SINGLE' && !transferStudentId) {
      toast.error("Please select a student to transfer");
      return;
    }

    const studentToTransfer = studentsInFromBatch.find(s => s.id === transferStudentId);
    let title = transferMode === 'BULK' ? 'Confirm Bulk Transfer' : 'Confirm Individual Transfer';
    let message = transferMode === 'BULK' 
      ? `You are about to transfer ALL students from ${transferFrom} to ${transferTo}. This will instantly update all their records. Do you want to proceed?`
      : `You are about to transfer ${studentToTransfer?.name || 'this student'} from ${transferFrom} to ${transferTo}. Do you want to proceed?`;

    setConfirmModal({ isOpen: true, title, message });
  };

  const executeTransfer = async () => {
    setConfirmModal(null);
    setTransferLoading(true);
    try {
      if (transferMode === 'BULK') {
        const { error } = await supabase.rpc('transfer_students', { 
          from_batch: transferFrom, 
          to_batch: transferTo 
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc('transfer_single_student', { 
          target_student_id: transferStudentId, 
          to_batch: transferTo 
        });
        if (error) throw error;
      }

      setTransferredInfo({ 
        name: transferMode === 'BULK' ? `All students from ${transferFrom}` : (studentsInFromBatch.find(s => s.id === transferStudentId)?.name || 'Student'), 
        to: transferTo 
      });
      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 3000);

      setTransferStudentId('');
      if (transferMode === 'SINGLE') {
        await fetchStudentsForBatch(); // Refresh current batch list
      }
      await refreshBatches();
      fetchAlumniCount();
    } catch (err: any) {
      toast.error('Transfer failed: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
            <History className="h-8 w-8 text-indigo-600" />
            Student Transfer
          </h1>
          <p className="text-slate-500 mt-1">Move students between batches or to Alumni status.</p>
        </div>
        
        <div className="bg-white px-4 py-2 rounded-xl border shadow-sm flex items-center gap-3">
          <div className="bg-indigo-50 p-2 rounded-lg">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Alumni</p>
            <p className="text-xl font-black text-slate-800">{alumniCount}</p>
          </div>
        </div>
      </div>

      {/* Transfer Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => setTransferMode('BULK')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${transferMode === 'BULK' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Bulk Transfer
            </button>
            <button
              onClick={() => setTransferMode('SINGLE')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${transferMode === 'SINGLE' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Individual
            </button>
          </div>
          
          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-100">
            <AlertCircle className="h-4 w-4" />
            <span>Transfers are permanent and update all records immediately.</span>
          </div>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 items-end">
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">From Batch</label>
              <select
                value={transferFrom}
                onChange={e => setTransferFrom(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-slate-700 font-semibold"
              >
                <option value="">Select Batch</option>
                {batches.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            {transferMode === 'SINGLE' && (
              <div className="space-y-2 animate-in slide-in-from-left-4 duration-300">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Target Student</label>
                <select
                  value={transferStudentId}
                  onChange={e => setTransferStudentId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-slate-700 font-semibold"
                  disabled={!transferFrom || studentsInFromBatch.length === 0}
                >
                  <option value="">{transferFrom ? "Choose Student..." : "Select Batch first"}</option>
                  {studentsInFromBatch.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.roll_number ? `(#${s.roll_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="items-center justify-center p-2 hidden lg:flex">
              <div className="h-10 w-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                <ArrowRight className="h-6 w-6" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Destination Batch</label>
              <select
                value={transferTo}
                onChange={e => setTransferTo(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 transition-all text-slate-700 font-semibold"
              >
                <option value="">Move to...</option>
                {batches.filter(b => b.name !== 'ALUMNI').map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
                <option value="ALUMNI" className="font-bold text-indigo-700 bg-indigo-50">✦ ALUMNI (Archive)</option>
              </select>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-50 flex justify-end">
            <button
              onClick={handleTransferClick}
              disabled={transferLoading || !transferFrom || !transferTo || (transferMode === 'SINGLE' && !transferStudentId)}
              className={`
                flex items-center gap-3 px-8 py-4 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg
                ${transferLoading || !transferFrom || !transferTo || (transferMode === 'SINGLE' && !transferStudentId)
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-indigo-600 text-white hover:bg-black hover:-translate-y-1 active:translate-y-0 shadow-indigo-100'}
              `}
            >
              {transferLoading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5" />
                  {transferMode === 'BULK' ? 'Confirm Bulk Transfer' : 'Complete Transfer'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Success Overlay Animation */}
      {showSuccessOverlay && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-white/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl shadow-2xl border border-indigo-100 p-8 max-w-sm w-full text-center scale-up-center animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 scale-90">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Transfer Complete!</h2>
            <p className="text-slate-500 text-sm mb-6 font-medium">
              <b className="text-indigo-600">{transferredInfo?.name}</b> was successfully moved to <b>{transferredInfo?.to}</b>.
            </p>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 transition-all duration-[3000ms] ease-linear w-full" />
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-amber-600">
              <div className="p-2 bg-amber-50 rounded-full">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">{confirmModal.title}</h3>
            </div>
            <p className="text-slate-600 mb-8 leading-relaxed">
              {confirmModal.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                disabled={transferLoading}
              >
                Cancel
              </button>
              <button
                onClick={executeTransfer}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
                disabled={transferLoading}
              >
                {transferLoading ? 'Processing...' : 'Yes, Transfer Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
          <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-2">
            <Users className="h-5 w-5" />
            What is Bulk Transfer?
          </h4>
          <p className="text-sm text-indigo-700/80 leading-relaxed">
            Use this when an entire batch completes their course or moves to the next level. 
            All students in the selected "From Batch" will be instantly moved to the "To Batch".
            Existing attendance records are preserved and mapped to the students.
          </p>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
            <GraduationCap className="h-5 w-5" />
            ALUMNI Status
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            Moving students to the <b>ALUMNI</b> batch hides them from daily operations like 
            attendance marking and dashboard stats, but keeps their historical data safe in the database.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Transfer;
