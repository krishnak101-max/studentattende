import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '../services/supabase';
import { BATCHES } from '../types';
import { Users, UserCheck, Calendar, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface BatchStats {
  batch: string;
  totalStudents: number;
  presentToday: number;
  loading: boolean;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<BatchStats[]>(BATCHES.map(b => ({
    batch: b,
    totalStudents: 0,
    presentToday: 0,
    loading: true
  })));
  const [globalLoading, setGlobalLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'dd-MM-yyyy'));

  useEffect(() => {
    fetchStats();
  }, [selectedDate]); // Refetch when date changes

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const dateObj = new Date(e.target.value);
    setSelectedDate(format(dateObj, 'dd-MM-yyyy'));
  };

  const fetchStats = async () => {
    setGlobalLoading(true);
    try {
      // 1. Fetch all students to calculate totals per batch
      const { data: students, error: sError } = await supabase
        .from('students')
        .select('id, batch');

      if (sError) throw sError;

      // 2. Fetch attendance for SELECTED DATE
      const { data: attendance, error: aError } = await supabase
        .from('attendance')
        .select('student_id, status')
        .eq('date', selectedDate)
        .eq('status', 'Present');

      if (aError) throw aError;

      // Calculate stats in memory
      const newStats = BATCHES.map(batch => {
        const batchStudents = students?.filter(s => s.batch === batch) || [];
        const batchStudentIds = new Set(batchStudents.map(s => s.id));

        const presentCount = attendance?.filter(a => batchStudentIds.has(a.student_id)).length || 0;

        return {
          batch,
          totalStudents: batchStudents.length,
          presentToday: presentCount,
          loading: false
        };
      });

      setStats(newStats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setGlobalLoading(false);
    }
  };

  const totalStudents = stats.reduce((acc, curr) => acc + curr.totalStudents, 0);
  const totalPresent = stats.reduce((acc, curr) => acc + curr.presentToday, 0);
  const attendancePercentage = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Overview for {selectedDate}</p>
        </div>
        <div className="bg-white p-2 rounded-lg border shadow-sm flex items-center gap-2 px-4">
          <Calendar className="text-primary h-5 w-5" />
          <input
            type="date"
            className="outline-none text-slate-700 bg-transparent font-semibold"
            value={selectedDate.split('-').reverse().join('-')}
            onChange={handleDateChange}
          />
        </div>
      </div>

      {/* Global Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-200 transform transition-all hover:scale-105">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 font-medium">Total Students</p>
              <h3 className="text-4xl font-bold mt-2">{totalStudents}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-green-200 transform transition-all hover:scale-105">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-green-100 font-medium">Present Today</p>
              <h3 className="text-4xl font-bold mt-2">{totalPresent}</h3>
            </div>
            <div className="bg-white/20 p-3 rounded-lg backdrop-blur-sm">
              <UserCheck className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col justify-center items-center">
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-slate-100"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={351.86}
                strokeDashoffset={351.86 - (351.86 * attendancePercentage) / 100}
                className="text-primary transition-all duration-1000 ease-out"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-bold text-slate-800">{attendancePercentage}%</span>
              <span className="text-xs text-slate-500 uppercase font-bold">Turnout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Class Cards Grid */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
          Details by Class
        </h2>

        {globalLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {stats.map((stat) => (
              <div
                key={stat.batch}
                onClick={() => navigate(`/attendance?batch=${stat.batch}&date=${selectedDate}`)}
                className="bg-white rounded-xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-primary/30 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-slate-50 to-slate-100 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-slate-700 bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 group-hover:bg-primary group-hover:text-white transition-colors">
                      {stat.batch}
                    </h3>
                    <div className="bg-slate-100 p-2 rounded-full group-hover:bg-blue-50 transition-colors">
                      <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-primary transition-colors" />
                    </div>
                  </div>

                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-bold text-slate-800">
                      {stat.presentToday}
                    </span>
                    <span className="text-slate-400 font-medium mb-1.5">
                      / {stat.totalStudents} Present
                    </span>
                  </div>

                  <div className="mt-4 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full transition-all duration-500"
                      style={{ width: `${stat.totalStudents > 0 ? (stat.presentToday / stat.totalStudents) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;