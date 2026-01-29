import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { BATCHES } from '../types';
import { Users, FileText, Download, ArrowLeft, AlertCircle, CalendarOff } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import toast from 'react-hot-toast';

interface AbsenteeStudent {
    id: string;
    name: string;
    batch: string;
    roll_number: string;
    total_absent: number;
    last_10_statuses: string[];
    consecutive_days: number;
}

const Absentees = () => {
    const [loading, setLoading] = useState(true);
    const [absentees, setAbsentees] = useState<AbsenteeStudent[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_student_absentee_stats');

            if (error) throw error;

            // Process Data in JS to find Streaks
            const processed = (data || []).map((s: any) => {
                const statuses = s.last_10_statuses || [];
                let streak = 0;

                // Count consecutive 'Absent' from the start (most recent)
                for (let status of statuses) {
                    if (status === 'Absent') {
                        streak++;
                    } else {
                        break; // Stop at first non-absent
                    }
                }

                return {
                    ...s,
                    consecutive_days: streak
                };
            }).filter((s: AbsenteeStudent) => s.consecutive_days >= 3); // Filter for 3+ days

            setAbsentees(processed);

        } catch (error) {
            console.error(error);
            toast.error("Failed to load absentee data. Run the SQL script.");
        } finally {
            setLoading(false);
        }
    };

    const getBatchCount = (batch: string) => {
        return absentees.filter(s => s.batch === batch).length;
    };

    const generatePDF = (batch: string) => {
        const students = absentees.filter(s => s.batch === batch);
        if (students.length === 0) return;

        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.setTextColor(41, 128, 185); // Blue
        doc.text("Continuous Absence Report", 14, 22);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Batch: ${batch}`, 14, 32);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 38);
        doc.text(`Criteria: Absent for 3+ consecutive days`, 14, 44);

        // Table
        const tableColumn = ["Roll No", "Student Name", "Consecutive Days", "Total Absences (All Time)"];
        const tableRows = students.map(s => [
            s.roll_number || '-',
            s.name,
            `${s.consecutive_days} Days`,
            s.total_absent
        ]);

        (doc as any).autoTable({
            startY: 50,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] }, // Red header for danger
            styles: { fontSize: 10, cellPadding: 3 }
        });

        doc.save(`Absence_Report_${batch}_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success("Report Downloaded");
    };

    // --- VIEW 1: BATCH CARDS ---
    if (!selectedBatch) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <CalendarOff className="h-7 w-7 text-red-600" />
                    Chronic Absentees
                </h1>
                <p className="text-slate-500">
                    Students who have been absent for <b>3 or more consecutive school days</b>.
                </p>

                {loading ? (
                    <div className="p-12 text-center text-slate-400">Analyzing patterns...</div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {BATCHES.map(batch => {
                            const count = getBatchCount(batch);
                            return (
                                <button
                                    key={batch}
                                    onClick={() => setSelectedBatch(batch)}
                                    className={`relative p-6 rounded-xl border-2 transition-all text-left group hover:-translate-y-1 hover:shadow-lg ${count > 0
                                            ? 'bg-white border-red-100 ring-1 ring-red-50 hover:border-red-300'
                                            : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <span className={`text-lg font-bold ${count > 0 ? 'text-slate-800' : 'text-slate-500'}`}>
                                            {batch}
                                        </span>
                                        {count > 0 && <AlertCircle className="h-5 w-5 text-red-500" />}
                                    </div>

                                    <div className="flex items-end gap-2">
                                        <span className={`text-4xl font-black ${count > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                                            {count}
                                        </span>
                                        <span className="text-sm text-slate-400 font-medium mb-2">Students</span>
                                    </div>

                                    {count > 0 && (
                                        <div className="absolute inset-x-0 bottom-0 h-1 bg-red-500 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // --- VIEW 2: DETAILED LIST ---
    const batchStudents = absentees.filter(s => s.batch === selectedBatch);

    return (
        <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setSelectedBatch(null)}
                        className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-6 w-6 text-slate-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Batch {selectedBatch}</h1>
                        <p className="text-red-600 font-medium flex items-center gap-1 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            {batchStudents.length} Critical Cases Found
                        </p>
                    </div>
                </div>

                <button
                    onClick={() => generatePDF(selectedBatch)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition-colors shadow-sm font-bold"
                >
                    <Download className="h-4 w-4" />
                    PDF Report
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {batchStudents.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        No students in this batch have 3+ consecutive absences.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-red-50 text-red-900 border-b border-red-100">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Roll No</th>
                                    <th className="px-6 py-4 font-bold">Student Name</th>
                                    <th className="px-6 py-4 font-bold">Consecutive Days</th>
                                    <th className="px-6 py-4 font-bold">Total Absences</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {batchStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-sm text-slate-500">
                                            {student.roll_number || '-'}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-800">
                                            {student.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">
                                                {student.consecutive_days} Days
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-medium">
                                            {student.total_absent} Days (All Time)
                                        </td>
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

export default Absentees;
