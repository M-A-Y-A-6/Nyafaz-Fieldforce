import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, User, Briefcase, ArrowRight } from 'lucide-react';
import { useDemoStore } from '../context/DemoStoreContext';

export default function Login() {
  const navigate = useNavigate();
  const { loginAsRole, loginWithCredentials, isLoading } = useDemoStore();

  const [activeRole, setActiveRole] = useState('manager'); // 'manager' | 'executive'
  const [email, setEmail] = useState('manager@nyafaz-demo.com');
  const [password, setPassword] = useState('Demo@123');
  const [error, setError] = useState('');

  const handleRoleToggle = (role) => {
    setActiveRole(role);
    setError('');
    if (role === 'manager') {
      setEmail('manager@nyafaz-demo.com');
    } else {
      setEmail('priya@nyafaz-demo.com');
    }
  };

  const handleQuickLogin = async (role) => {
    setError('');
    const res = await loginAsRole(role);
    if (res.success) {
      navigate(role === 'manager' ? '/manager/dashboard' : '/executive/calendar');
    } else {
      setError(res.message || 'Login failed');
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const res = await loginWithCredentials(email, password);
    if (res.success) {
      navigate(res.user.role === 'manager' ? '/manager/dashboard' : '/executive/calendar');
    } else {
      setError(res.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-sm p-8 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 mb-1">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Nyafaz FieldForce
          </h1>
          <p className="text-sm text-slate-500">
            Salon Field Sales & Operations MVP
          </p>
        </div>

        {/* 1-Click Role Switcher Toggle */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
            1-Click Demo Login
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickLogin('manager')}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Briefcase className="w-4 h-4" />
              <span>Login as Manager</span>
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleQuickLogin('executive')}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Login as Executive</span>
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-slate-200 w-full" />
          <span className="bg-white px-3 text-xs text-slate-400 uppercase tracking-wider">
            Or Sign In
          </span>
        </div>

        {/* Manual Login Form */}
        <form onSubmit={handleFormSubmit} className="space-y-4">
          
          {/* Role selector tab */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => handleRoleToggle('manager')}
              className={`py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                activeRole === 'manager'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sales Manager
            </button>
            <button
              type="button"
              onClick={() => handleRoleToggle('executive')}
              className={`py-1.5 text-xs font-semibold rounded-md transition cursor-pointer ${
                activeRole === 'executive'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Sales Executive
            </button>
          </div>

          {error && (
            <div className="p-3 text-xs rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>{isLoading ? 'Signing In...' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
