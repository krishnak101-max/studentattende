import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { supabase } from '../services/supabase';
import { BATCHES, Student } from '../types';
import { Plus, Trash2, Edit2, Upload, Download, Search, X, FileSpreadsheet, History, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';

const Students = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({ name: '', batch: BATCHES[0], sex: 'Male', roll_number: '' });

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
    if (!error) setStudents(data as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.toUpperCase(), // FORCE UPPERCASE
        batch: formData.batch,
        sex: formData.sex,
        roll_number: formData.roll_number || null
      };

      if (editingId) {
        await supabase.from('students').update(payload).eq('id', editingId);
        toast.success('Student updated');
      } else {
        await supabase.from('students').insert([payload]);
        toast.success('Student added');
      }
      setIsModalOpen(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      toast.error('Operation failed');
    }
  };

  const handleAutoAssignRollNumbers = async (targetBatch: string) => {
    if (!confirm(`This will re-assign Roll Numbers for ALL students in ${targetBatch} based on:\n1. Females (A-Z)\n2. Males (A-Z)\n\nProceed?`)) return;
    
    setLoading(true);
    try {
      // 1. Fetch all students in batch
      const { data: batchStudents, error } = await supabase
        .from('students')
        .select('*')
        .eq('batch', targetBatch);
      
      if (error) throw error;
      if (!batchStudents || batchStudents.length === 0) {
        toast.error('No students in this batch');
        setLoading(false);
        return;
      }

      // 2. Sort: Female First, then Male. Inside that: Alphabetical Name
      const sorted = batchStudents.sort((a, b) => {
        // Primary Sort: Sex (Female < Male)
        if (a.sex !== b.sex) {
          return a.sex === 'Female' ? -1 : 1;
        }
        // Secondary Sort: Name (A-Z)
        return a.name.localeCompare(b.name);
      });

      // 3. Prepare Updates (Roll Number = Index + 1)
      const updates = sorted.map((s, index) => ({
        ...s,
        roll_number: (index + 1).toString()
      }));

      // 4. Upsert back to DB
      const { error: updateError } = await supabase.from('students').upsert(updates);
      if (updateError) throw updateError;

      toast.success(`Assigned Roll Numbers 1-${updates.length} for ${targetBatch}`);
      fetchStudents();

    } catch (err) {
      console.error(err);
      toast.error('Failed to assign roll numbers');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure? This will delete all attendance records for this student.')) return;
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (!error) {
      toast.success('Student deleted');
      fetchStudents();
    } else {
      toast.error('Delete failed');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', batch: BATCHES[0], sex: 'Male', roll_number: '' });
    setEditingId(null);
  };

  const openEdit = (s: Student) => {
    setFormData({ 
      name: s.name, 
      batch: s.batch, 
      sex: s.sex as string,
      roll_number: s.roll_number || ''
    });
    setEditingId(s.id);
    setIsModalOpen(true);
  };

  const handleDownloadTemplate = () => {
    const csvContent = "name,batch,sex,roll_number\nJOHN DOE,S1,Male,1\nJANE SMITH,N1,Female,2";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "student_import_template.csv";
    link.click();
    toast.success("Template downloaded");
  };

  const handleExportData = () => {
    if (students.length === 0) {
      toast.error("No students to export");
      return;
    }
    const dataToExport = students.map(({ name, batch, sex, roll_number }) => ({ name, batch, sex, roll_number }));
    const csv = Papa.unparse(dataToExport);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wings_students_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    toast.success("Student data exported");
  };

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const validRows = rows.map(r => ({
          name: r.name?.toUpperCase(), // Ensure uppercase on import
          batch: r.batch,
          sex: r.sex || 'Male',
          roll_number: r.roll_number || null
        })).filter(r => r.name && r.batch);

        if (validRows.length > 0) {
          const { error } = await supabase.from('students').insert(validRows);
          if (!error) {
            toast.success(`Imported ${validRows.length} students`);
            fetchStudents();
          } else {
            console.error(error);
            toast.error('Database error during import');
          }
        } else {
          toast.error('No valid rows found in CSV');
        }
      }
    });
    e.target.value = ''; 
  };

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || 
    s.batch.toLowerCase().includes(search.toLowerCase()) ||
    (s.roll_number && s.roll_number.toLowerCase().includes(search.toLowerCase()))
  );

  const displayList = search ? filteredStudents : filteredStudents.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Student Management</h1>
        <div className="flex flex-wrap gap-2 w-full xl:w-auto">
          {/* Utilities */}
          <div className="flex gap-2">
            <button 
              onClick={handleDownloadTemplate}
              className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
              title="Download CSV Template"
            >
              <FileSpreadsheet className="h-5 w-5" />
            </button>
            <button 
              onClick={handleExportData}
              className="p-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700"
              title="Export Current Data"
            >
              <Download className="h-5 w-5" />
            </button>
            <label className="p-2 bg-white border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 text-slate-700" title="Import CSV">
              <Upload className="h-5 w-5" />
              <input type="file" accept=".csv" onChange={handleCSVImport} className="hidden" />
            </label>
          </div>

          <div className="h-6 w-px bg-slate-300 mx-2 hidden xl:block"></div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors font-medium">
                <Wand2 className="h-4 w-4" />
                <span>Auto Roll No.</span>
              </button>
              {/* Dropdown for batch selection */}
              <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 p-2 hidden group-hover:block z-20">
                <p className="text-xs text-slate-400 px-2 py-1">Select Batch to Sort:</p>
                {BATCHES.map(b => (
                  <button
                    key={b}
                    onClick={() => handleAutoAssignRollNumbers(b)}
                    className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 rounded-md"
                  >
                    {b} (Female First)
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={() => { resetForm(); setIsModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-800 transition-colors shadow-sm whitespace-nowrap font-bold"
            >
              <Plus className="h-4 w-4" />
              Add Student
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, roll no, or batch..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-100 outline-none bg-white uppercase placeholder:normal-case"
            />
          </div>
          {!search && (
            <div className="flex items-center gap-2 text-slate-500 text-sm italic">
              <History className="h-4 w-4" />
              <span>Showing recently added 5 students</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-sm uppercase font-semibold tracking-wider">
              <tr>
                <th className="px-6 py-4">Roll No</th>
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Batch</th>
                <th className="px-6 py-4">Sex</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr><td colSpan={5} className="p-6 text-center text-slate-500">Loading...</td></tr>
              ) : displayList.length === 0 ? (
                 <tr><td colSpan={5} className="p-6 text-center text-slate-500">
                    {search ? "No students found matching your search." : "No students in database."}
                 </td></tr>
              ) : displayList.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-slate-600 font-mono text-sm font-bold">
                    {student.roll_number || '-'}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 uppercase">{student.name}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                      {student.batch}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{student.sex}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => openEdit(student)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(student.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">{editingId ? 'Edit Student' : 'Add New Student'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-slate-600" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-100 outline-none uppercase"
                  placeholder="e.g. JOHN DOE"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number (Manual)</label>
                <input
                  type="text"
                  value={formData.roll_number}
                  onChange={(e) => setFormData({...formData, roll_number: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-100 outline-none"
                  placeholder="Auto-assign available in list view"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Batch</label>
                  <select
                    value={formData.batch}
                    onChange={(e) => setFormData({...formData, batch: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  >
                    {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sex</label>
                  <select
                    value={formData.sex}
                    onChange={(e) => setFormData({...formData, sex: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button type="submit" className="w-full bg-primary text-white py-2 rounded-lg font-bold hover:bg-blue-800 transition-colors">
                  {editingId ? 'Update Student' : 'Create Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Students;