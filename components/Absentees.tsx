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
    weekly_count: number; // Absences in last 6 working days
    risk_type: 'CONSECUTIVE' | 'FREQUENT' | 'BOTH';
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

            // Process Data
            const processed = (data || []).map((s: any) => {
                const statuses = s.last_10_statuses || [];

                // 1. Calculate Consecutive Streak (from start)
                let streak = 0;
                for (let status of statuses) {
                    if (status === 'Absent') streak++;
                    else break;
                }

                // 2. Calculate "Weekly" Frequency (Absences in last 6 working days)
                // We consider 6 days as a standard coaching week
                const last6Days = statuses.slice(0, 6);
                const weeklyCount = last6Days.filter((st: string) => st === 'Absent').length;

                // Determine Risk
                let risk: 'CONSECUTIVE' | 'FREQUENT' | 'BOTH' | null = null;

                const isConsecutive = streak >= 3;
                const isFrequent = weeklyCount > 2; // More than 2 times (i.e. 3+)

                if (isConsecutive && isFrequent) risk = 'BOTH';
                else if (isConsecutive) risk = 'CONSECUTIVE';
                else if (isFrequent) risk = 'FREQUENT';

                return {
                    ...s,
                    consecutive_days: streak,
                    weekly_count: weeklyCount,
                    risk_type: risk
                };
            }).filter((s: AbsenteeStudent) => s.risk_type !== null); // Keep if any risk

            setAbsentees(processed);

        } catch (error) {
            console.error(error);
            toast.error("Failed to load data.");
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
        doc.setTextColor(41, 128, 185);
        doc.text("Absentee & Risk Report", 14, 22);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`Batch: ${batch} | Date: ${new Date().toLocaleDateString()}`, 14, 32);
        doc.text(`Criteria: 3+ Consecutive Absences OR >2 Absences in last week`, 14, 38);

        // Table
        const tableColumn = ["Roll No", "Name", "Risk Issue", "Recent Pattern", "Total"];
        const tableRows = students.map(s => {
            let issue = "";
            if (s.risk_type === 'CONSECUTIVE') issue = `Streak: ${s.consecutive_days} Days`;
            else if (s.risk_type === 'FREQUENT') issue = `Frequent: ${s.weekly_count}/6 Days`;
            else issue = `CRITICAL: ${s.consecutive_days} Day Streak`;

            return [
                s.roll_number || '-',
                s.name,
                issue,
                s.last_10_statuses.slice(0, 7).map((st: string) => st === 'Absent' ? 'A' : 'P').join('-'),
                s.total_absent
            ];
        });

        (doc as any).autoTable({
            startY: 45,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [231, 76, 60] },
            styles: { fontSize: 9, cellPadding: 3 }
        });

        doc.save(`Risk_Report_${batch}_${new Date().toISOString().slice(0, 10)}.pdf`);
        toast.success("Report Downloaded");
    };

    // --- VIEW 1: BATCH CARDS ---
    if (!selectedBatch) {
        return (
            <div className="space-y-6 animate-in fade-in duration-300">
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <CalendarOff className="h-7 w-7 text-red-600" />
                    Absentee Risk Analysis
                </h1>
                <p className="text-slate-500 max-w-2xl">
                    Identifying students with <b>Continuous Absences (3+)</b> OR <b>Frequent Irregular Absences</b> (3+ in last week).
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
                                        <span className="text-sm text-slate-400 font-medium mb-2">Risks Found</span>
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
                            {batchStudents.length} Risk Cases
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
                        No risk cases found in this batch.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Roll No</th>
                                    <th className="px-6 py-4 font-bold">Student Name</th>
                                    <th className="px-6 py-4 font-bold">Risk Type</th>
                                    <th className="px-6 py-4 font-bold">Details</th>
                                    <th className="px-6 py-4 font-bold">Total Absent</th>
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
                                            {student.risk_type === 'CONSECUTIVE' && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                                    Consecutive
                                                </span>
                                            )}
                                            {student.risk_type === 'FREQUENT' && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                                    Frequent
                                                </span>
                                            )}
                                            {student.risk_type === 'BOTH' && (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                    Critical
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {student.risk_type === 'CONSECUTIVE' && (
                                                <span>Absent for last <b>{student.consecutive_days}</b> classes</span>
                                            )}
                                            {student.risk_type === 'FREQUENT' && (
                                                <span>Absent <b>{student.weekly_count}</b> times in last 6 days</span>
                                            )}
                                            {student.risk_type === 'BOTH' && (
                                                <span><b>{student.consecutive_days}</b> day streak (Critical)</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 font-mono text-xs">
                                            {student.total_absent}
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
