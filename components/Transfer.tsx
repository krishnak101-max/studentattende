import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useBatches } from '../context/BatchContext';
import { History, ArrowRight, CheckCircle2, AlertCircle, Users, GraduationCap, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

const Transfer = () => {
  const { batches, refreshBatches } = useBatches();
  
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferMode, setTransferMode] = useState<'BULK' | 'SINGLE'>('BULK');
  const [studentsInFromBatch, setStudentsInFromBatch] = useState<any[]>([]);
  const [alumniCount, setAlumniCount] = useState(0);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [transferredInfo, setTransferredInfo] = useState<{name: string, to: string} | null>(null);
  
  const [rowTargets, setRowTargets] = useState<Record<string, string>>({});
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, message: string, title: string, studentId?: string, targetBatch?: string} | null>(null);

  useEffect(() => {
    fetchAlumniCount();
  }, [batches]);

  // Fetch students when transferFrom changes
  useEffect(() => {
    if (transferFrom) {
      fetchStudentsForBatch();
    } else {
      setStudentsInFromBatch([]);
    }
  }, [transferFrom]);

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
        .select('*')
        .eq('batch', transferFrom)
        .order('name');
      
      if (!error) setStudentsInFromBatch(data || []);
    } catch (err) {
      console.error('Failed to fetch students for batch');
    }
  };

  const handleBulkTransferClick = () => {
    if (!transferFrom || !transferTo) return;
    if (transferFrom === transferTo) {
      toast.error("Source and destination batches are the same");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Bulk Transfer',
      message: `You are about to transfer ALL students from ${transferFrom} to ${transferTo}. This will instantly update all their records. Do you want to proceed?`
    });
  };

  const handleSingleTransferClick = (studentId: string, studentName: string, targetBatch: string) => {
    if (!targetBatch) {
      toast.error("Please select a destination batch for this student.");
      return;
    }
    if (transferFrom === targetBatch) {
      toast.error("Source and destination batches are the same");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Individual Transfer',
      message: `You are about to transfer ${studentName} from ${transferFrom} to ${targetBatch}. Do you want to proceed?`,
      studentId,
      targetBatch
    });
  };

  const executeTransfer = async () => {
    if (!confirmModal) return;
    const { studentId, targetBatch } = confirmModal;
    
    setTransferLoading(true);
    setConfirmModal(null);
    try {
      if (transferMode === 'BULK') {
        const { error } = await supabase.rpc('transfer_students', { 
          from_batch: transferFrom, 
          to_batch: transferTo 
        });
        
        if (error) {
          console.warn("RPC failed, falling back to basic UPDATE");
          const { error: fallbackError } = await supabase
            .from('students')
            .update({ batch: transferTo })
            .eq('batch', transferFrom);
          if (fallbackError) throw fallbackError;
        }

        setTransferredInfo({ name: `All students from ${transferFrom}`, to: transferTo });
      } else if (studentId && targetBatch) {
        // Safe update for single transfer without relying on RPC
        const { error } = await supabase
          .from('students')
          .update({ batch: targetBatch })
          .eq('id', studentId);
          
        if (error) throw error;
        
        const st = studentsInFromBatch.find(s => s.id === studentId);
        setTransferredInfo({ name: st?.name || 'Student', to: targetBatch });
      }

      setShowSuccessOverlay(true);
      setTimeout(() => setShowSuccessOverlay(false), 3000);

      await fetchStudentsForBatch(); // Refresh current batch list
      await refreshBatches();
      fetchAlumniCount();
    } catch (err: any) {
      toast.error('Transfer failed: ' + (err.message || 'Unknown error'));
      console.error(err);
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDownloadExcel = () => {
    if (studentsInFromBatch.length === 0) {
      toast.error("No students found to download.");
      return;
    }

    const csvData = studentsInFromBatch.map((s, i) => ({
      '#': i + 1,
      'Reg No': s.register_number || '',
      'Name': s.name || '',
      'Batch': s.batch || '',
      'Sex': s.sex || '',
      'Phone': s.phone_number || '',
      'Medium': s.medium || '',
      'First Language': s.first_language || '',
      'Father Name': s.father_name || '',
      'Mother Name': s.mother_name || '',
      'Address': s.address || ''
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Students_Batch_${transferFrom}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downloaded Excel/CSV file");
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-end">
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

            {transferMode === 'BULK' && (
              <div className="flex justify-end lg:col-start-3">
                <button
                  onClick={handleBulkTransferClick}
                  disabled={transferLoading || !transferFrom || !transferTo}
                  className={`
                    w-full flex justify-center items-center gap-3 px-6 py-3 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg
                    ${transferLoading || !transferFrom || !transferTo
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-indigo-600 text-white hover:bg-black hover:-translate-y-1 active:translate-y-0 shadow-indigo-100'}
                  `}
                >
                  {transferLoading ? 'Processing...' : <><CheckCircle2 className="h-5 w-5" /> Confirm Bulk</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid view for INDIVIDUAL Transfer */}
      {transferMode === 'SINGLE' && transferFrom && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600" />
              Students in {transferFrom} ({studentsInFromBatch.length})
            </h3>
            <button
              onClick={handleDownloadExcel}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold text-sm shadow-sm"
            >
              <Download className="h-4 w-4" /> Download Excel
            </button>
          </div>
          
          {studentsInFromBatch.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium">
              No students found in {transferFrom}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4 font-bold">Reg No</th>
                    <th className="p-4 font-bold">Name</th>
                    <th className="p-4 font-bold">Phone</th>
                    <th className="p-4 font-bold">Destination</th>
                    <th className="p-4 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {studentsInFromBatch.map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="p-4 text-sm font-semibold text-slate-600">{s.register_number || '-'}</td>
                      <td className="p-4 text-sm font-bold text-slate-800">{s.name}</td>
                      <td className="p-4 text-sm text-slate-600">{s.phone_number || '-'}</td>
                      <td className="p-4">
                        <select
                          className="w-full max-w-[180px] border border-slate-200 bg-white px-3 py-1.5 rounded-lg outline-none focus:border-indigo-500 text-sm font-semibold"
                          value={rowTargets[s.id] || transferTo || ''}
                          onChange={(e) => setRowTargets({...rowTargets, [s.id]: e.target.value})}
                        >
                          <option value="">Move to...</option>
                          {batches.filter(b => b.name !== 'ALUMNI' && b.name !== s.batch).map(b => (
                            <option key={b.id} value={b.name}>{b.name}</option>
                          ))}
                          <option value="ALUMNI" className="font-bold text-indigo-700 bg-indigo-50">✦ ALUMNI</option>
                        </select>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleSingleTransferClick(s.id, s.name, rowTargets[s.id] || transferTo)}
                          className="bg-indigo-600 hover:bg-black text-white px-4 py-1.5 rounded-lg font-bold text-sm transition shadow-sm opacity-50 group-hover:opacity-100 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={!(rowTargets[s.id] || transferTo) || transferLoading}
                        >
                          Transfer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
        <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
          <h4 className="font-bold text-indigo-900 flex items-center gap-2 mb-2">
            <Users className="h-5 w-5" />
            What is Bulk Transfer?
          </h4>
          <p className="text-sm text-indigo-700/80 leading-relaxed">
            Use this when an entire batch completes their course or moves to the next level. 
            All students in the selected "From Batch" will be instantly moved to the "To Batch", keeping data intact.
          </p>
        </div>
        
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
          <h4 className="font-bold text-slate-800 flex items-center gap-2 mb-2">
            <GraduationCap className="h-5 w-5" />
            ALUMNI Status
          </h4>
          <p className="text-sm text-slate-600 leading-relaxed">
            Moving students to the <b>ALUMNI</b> batch archives them. They are hidden from daily operations like 
            attendance, but their historical data remains safe.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Transfer;
