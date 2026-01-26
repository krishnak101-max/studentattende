import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  FileBarChart, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  GraduationCap
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    sessionStorage.removeItem('wings_auth');
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: 'Attendance', icon: LayoutDashboard },
    { path: '/students', label: 'Students', icon: Users },
    { path: '/reports', label: 'Reports', icon: FileBarChart },
    { path: '/admin', label: 'Admin Tools', icon: Settings },
  ];

  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 w-full bg-primary text-white z-50 flex items-center justify-between p-4 shadow-md">
        <div className="flex items-center gap-2 font-bold text-lg">
          <GraduationCap className="h-6 w-6" />
          <span>Wings Coaching</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out
          md:relative md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 bg-primary text-white flex items-center gap-3">
            <GraduationCap className="h-8 w-8 text-accent" />
            <div>
              <h1 className="font-bold text-xl leading-none">Wings</h1>
              <p className="text-blue-200 text-xs mt-1">Coaching Center</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={closeSidebar}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium
                    ${isActive 
                      ? 'bg-blue-50 text-primary border-l-4 border-primary' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-primary'}
                  `}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-100">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              <LogOut className="h-5 w-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full pt-16 md:pt-0 overflow-y-auto h-screen">
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;