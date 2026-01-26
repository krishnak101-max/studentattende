import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Attendance from './components/Attendance';
import Students from './components/Students';
import Reports from './components/Reports';
import AdminTools from './components/AdminTools';

// Simple Auth Context Logic
const ProtectedRoute = ({ children }: { children?: React.ReactNode }) => {
  const isAuth = sessionStorage.getItem('wings_auth') === 'true';
  return isAuth ? <>{children}</> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/attendance" element={<Attendance />} />
                    <Route path="/students" element={<Students />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/admin" element={<AdminTools />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </HashRouter>
      <Toaster position="top-right" />
    </div>
  );
}

export default App;