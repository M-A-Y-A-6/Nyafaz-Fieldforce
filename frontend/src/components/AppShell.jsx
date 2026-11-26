import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckSquare,
  Users,
  PlusCircle,
  Store,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useDemoStore } from '../context/DemoStoreContext';

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useDemoStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(location.pathname);

  // Auto-close mobile drawer if route changes
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setMobileMenuOpen(false);
  }

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center max-w-sm w-full space-y-3">
          <p className="text-sm text-slate-600">Please sign in to continue.</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const isManager = currentUser.role === 'manager';

  // Strictly limited tabs:
  // Executive: ONLY Calendar and Daily Tasks
  const executiveTabs = [
    { name: 'Calendar', path: '/executive/calendar', icon: Calendar },
    { name: 'Daily Tasks', path: '/executive/tasks', icon: CheckSquare }
  ];

  // Manager: ONLY Dashboard, Sales Executives, Assign Task, and Salons
  const managerTabs = [
    { name: 'Dashboard', path: '/manager/dashboard', icon: Building2 },
    { name: 'Sales Executives', path: '/manager/executives', icon: Users },
    { name: 'Assign Task', path: '/manager/assign', icon: PlusCircle },
    { name: 'Salons', path: '/manager/salons', icon: Store }
  ];

  const tabs = isManager ? managerTabs : executiveTabs;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = (
    <nav className="space-y-1">
      <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
        {isManager ? 'Manager Menu' : 'Executive Menu'}
      </div>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = location.pathname === tab.path;
        return (
          <NavLink
            key={tab.path}
            to={tab.path}
            onClick={() => setMobileMenuOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-lg transition ${
              isActive
                ? 'bg-indigo-50 text-indigo-600 font-bold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
            <span>{tab.name}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">

      {/* Clean Minimal Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 h-16 w-full">
        <div className="w-full px-4 sm:px-6 flex items-center justify-between h-full">

          {/* Left: Mobile Menu Toggle & Logo / Brand */}
          <div className="flex items-center gap-3">
            {/* Mobile Menu Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Logo & Brand */}
            <div
              onClick={() => navigate(isManager ? '/manager/dashboard' : '/executive/calendar')}
              className="flex items-center gap-2.5 cursor-pointer select-none"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                N
              </div>
              <span className="font-bold text-base text-slate-900 tracking-tight">
                Nyafaz FieldForce
              </span>
            </div>
          </div>

          {/* Right: User Name & Logout Button */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="text-right">
              <div className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-slate-500 font-medium capitalize">
                {isManager ? 'Sales Manager' : 'Sales Executive'}
              </div>
            </div>

            <button
              onClick={handleLogout}
              title="Sign out"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-medium transition cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </header>

      <div className="flex-1 flex">
        {/* Desktop Fixed Left Sidebar (w-60) */}
        <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:top-16 md:bottom-0 md:left-0 bg-white border-r border-slate-200 z-20 overflow-y-auto">
          <div className="p-4 flex-1">
            {navLinks}
          </div>
        </aside>

        {/* Mobile Collapsible Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Panel */}
            <div className="relative w-64 max-w-[80vw] bg-white h-full shadow-xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
              <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-xs">
                    N
                  </div>
                  <span className="font-bold text-base text-slate-900 tracking-tight">
                    Nyafaz FieldForce
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                  aria-label="Close sidebar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {navLinks}
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 md:pl-60 min-w-0">
          <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>

    </div>
  );
}
