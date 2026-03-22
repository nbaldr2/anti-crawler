import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { authService } from '@/services/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/overview', label: 'Overview' },
    { path: '/traffic', label: 'Traffic Drill-Down' },
    { path: '/rules', label: 'Rules Management' },
    { path: '/lists', label: 'Allow/Deny Lists' },
    { path: '/settings', label: 'Settings' },
  ];

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-primary-700 text-white flex-shrink-0">
        <div className="p-4">
          <h1 className="text-2xl font-bold">Antibot Dashboard</h1>
        </div>
        <nav className="mt-8">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-4 py-3 hover:bg-primary-600 transition-colors ${
                  isActive ? 'bg-primary-800 border-r-4 border-yellow-400' : ''
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto p-4">
          <button
            onClick={handleLogout}
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-semibold py-2 px-4 rounded"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        {children}
      </main>
    </div>
  );
};