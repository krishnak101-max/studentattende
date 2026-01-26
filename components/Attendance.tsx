import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { BATCHES, AttendanceRecord } from '../types';
import { Calendar as CalendarIcon, Save, Search, Share2, Check, X, CheckSquare, Square, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const Attendance = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [selectedBatch, setSelectedBatch] = useState(searchParams.get('batch') || BATCHES[0]);
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'dd-MM-yyyy'));
    const [searchQuery, setSearchQuery] = useState('');
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showSummary, setShowSummary] = useState(false);
    const [absentees, setAbsentees] = useState<string[]>([]);

    useEffect(() => {
        const batchParam = searchParams.get('batch');
        if (batchParam && BATCHES.includes(batchParam)) {
            setSelectedBatch(batchParam);
        }

        const dateParam = searchParams.get('date'); // Format: dd-MM-yyyy
        if (dateParam) {
            setSelectedDate(dateParam);
        }
    }, [searchParams]);

    // Convert HTML date input (YYYY-MM-DD) to Display format (DD-MM-YYYY)
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) return;
        const dateObj = new Date(e.target.value);
        setSelectedDate(format(dateObj, 'dd-MM-yyyy'));
    };

    const fetchBatchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Students in Batch
            const { data: students, error: sError } = await supabase
                .from('students')
                .select('*')
                .eq('batch', selectedBatch);

            if (sError) throw sError;

            // Sort Logic: Female (A-Z) -> Male (A-Z)
            const sortedStudents = (students || []).sort((a, b) => {
                // 1. Sort by Sex: Female < Male
                if (a.sex !== b.sex) {
                    return a.sex === 'Female' ? -1 : 1;
                }
                // 2. Sort by Name
                return a.name.localeCompare(b.name);
            });

            // 2. Fetch Attendance for Date
            const { data: attendance, error: aError } = await supabase
                .from('attendance')
                .select('*')
                .in('student_id', sortedStudents.map(s => s.id))
                .eq('date', selectedDate);

            if (aError) throw aError;

            // 3. Merge Data
            const attendanceMap = new Map();
            attendance?.forEach(a => attendanceMap.set(a.student_id, a.status));

            const merged: AttendanceRecord[] = sortedStudents.map(s => ({
                ...s,
                status: attendanceMap.has(s.id) ? attendanceMap.get(s.id) : 'Absent',
                attendanceId: attendance?.find(a => a.student_id === s.id)?.id
            }));

            setRecords(merged);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatchData();
    }, [selectedBatch, selectedDate]);

    const toggleStatus = (id: string) => {
        setRecords(prev => prev.map(r => {
            if (r.id === id) {
                return { ...r, status: r.status === 'Present' ? 'Absent' : 'Present' };
            }
            return r;
        }));
    };

    const markAllPresent = () => {
        setRecords(prev => prev.map(r => ({ ...r, status: 'Present' })));
        toast.success('Marked all as Present');
    };

    const markAllAbsent = () => {
        setRecords(prev => prev.map(r => ({ ...r, status: 'Absent' })));
        toast.success('Reset to Absent');
    };

    const saveAttendance = async () => {
        setSaving(true);
        try {
            const updates = records.map(r => ({
                student_id: r.id,
                date: selectedDate,
                status: r.status
            }));

            const { error } = await supabase
                .from('attendance')
                .upsert(updates, { onConflict: 'student_id,date' });

            if (error) throw error;

            toast.success('Attendance saved!');

            const absentList = records.filter(r => r.status === 'Absent').map(r => r.name);
            setAbsentees(absentList);
            setShowSummary(true);

        } catch (error) {
            console.error(error);
            toast.error('Failed to save attendance');
        } finally {
            setSaving(false);
        }
    };

    const copyToWhatsapp = () => {
        const text = `*Wings Coaching Center*\nBatch: ${selectedBatch}\nDate: ${selectedDate}\n\n*Absentees:*\n${absentees.map((name, i) => `${i + 1}. ${name}`).join('\n')}`;
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    const filteredRecords = records.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.roll_number && r.roll_number.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 text-slate-500 hover:text-primary mb-2 transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Dashboard
                    </button>
                    <h1 className="text-2xl font-bold text-slate-800">Daily Attendance</h1>
                    <p className="text-slate-500">Manage student presence</p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                    <CalendarIcon className="text-slate-400 h-5 w-5 ml-2" />
                    <input
                        type="date"
                        className="outline-none text-slate-700 bg-transparent"
                        value={selectedDate.split('-').reverse().join('-')}
                        onChange={handleDateChange}
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {BATCHES.map(batch => (
                    <button
                        key={batch}
                        onClick={() => {
                            setSelectedBatch(batch);
                            // Update URL without reloading
                            navigate(`/attendance?batch=${batch}`, { replace: true });
                        }}
                        className={`
              px-6 py-2 rounded-full font-semibold transition-all shadow-sm
              ${selectedBatch === batch
                                ? 'bg-primary text-white shadow-md transform scale-105'
                                : 'bg-white text-slate-600 hover:bg-slate-100'}
            `}
                    >
                        {batch}
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b flex flex-col xl:flex-row gap-4 justify-between items-center sticky top-0 bg-white z-10">
                    <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search name or roll no..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-100 focus:border-primary outline-none uppercase placeholder:normal-case"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={markAllPresent}
                                className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm font-medium"
                                title="Mark all as Present"
                            >
                                <CheckSquare className="h-4 w-4" />
                                All Present
                            </button>
                            <button
                                onClick={markAllAbsent}
                                className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium"
                                title="Unmark All"
                            >
                                <Square className="h-4 w-4" />
                                Reset
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm font-medium text-slate-600">
                        <span>Total: {records.length}</span>
                        <span className="text-green-600">Present: {records.filter(r => r.status === 'Present').length}</span>
                        <span className="text-red-500">Absent: {records.filter(r => r.status === 'Absent').length}</span>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto">
                    {loading ? (
                        <div className="p-12 text-center text-slate-500">Loading students...</div>
                    ) : filteredRecords.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">No students found for this batch.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                            {filteredRecords.map((student) => {
                                const originalIndex = records.findIndex(r => r.id === student.id);
                                const sequentialRoll = originalIndex !== -1 ? (originalIndex + 1).toString().padStart(2, '0') : '--';

                                const displayRoll = (student.roll_number && student.roll_number !== '00')
                                    ? student.roll_number
                                    : sequentialRoll;

                                return (
                                    <div
                                        key={student.id}
                                        onClick={() => toggleStatus(student.id)}
                                        className={`
                      cursor-pointer p-4 rounded-lg border-2 transition-all flex items-center justify-between group select-none relative
                      ${student.status === 'Present'
                                                ? 'border-green-500 bg-green-50 shadow-sm'
                                                : 'border-slate-100 hover:border-blue-300 bg-white'}
                    `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-2 shrink-0
                        ${student.status === 'Present' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}
                      `}>
                                                {displayRoll}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-slate-800 uppercase">{student.name}</h3>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <span className={`px-1.5 rounded font-bold ${student.sex === 'Female' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {student.sex === 'Female' ? 'F' : 'M'}
                                                    </span>
                                                    <span className="bg-slate-100 px-1 rounded border border-slate-200">
                                                        Roll: {displayRoll}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`
                      w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0
                      ${student.status === 'Present' ? 'border-green-500 bg-green-500 text-white' : 'border-slate-300 text-transparent'}
                    `}>
                                            <Check className="h-4 w-4" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-end sticky bottom-0 z-20">
                    <button
                        onClick={saveAttendance}
                        disabled={loading || saving}
                        className="flex items-center gap-2 bg-primary hover:bg-blue-800 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50 transition-all"
                    >
                        {saving ? 'Saving...' : (
                            <>
                                <Save className="h-5 w-5" />
                                Save Attendance
                            </>
                        )}
                    </button>
                </div>
            </div>

            {showSummary && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-green-600 p-6 text-white flex justify-between items-start">
                            <div>
                                <h2 className="text-xl font-bold">Attendance Saved</h2>
                                <p className="text-green-100 mt-1">{selectedDate} • {selectedBatch}</p>
                            </div>
                            <button onClick={() => setShowSummary(false)} className="text-white/80 hover:text-white">
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6">
                            <h3 className="font-semibold text-slate-800 mb-3 flex items-center justify-between">
                                <span>Absentees List</span>
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                    {absentees.length} Students
                                </span>
                            </h3>

                            <div className="bg-slate-50 rounded-lg p-4 max-h-48 overflow-y-auto mb-6 border border-slate-100">
                                {absentees.length > 0 ? (
                                    <ol className="list-decimal list-inside text-sm text-slate-700 space-y-1">
                                        {absentees.map((name, i) => (
                                            <li key={i}>{name}</li>
                                        ))}
                                    </ol>
                                ) : (
                                    <p className="text-green-600 text-sm text-center">No absentees! 🎉</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowSummary(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={copyToWhatsapp}
                                    className="flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors"
                                >
                                    <Share2 className="h-4 w-4" />
                                    Copy List
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Attendance;
