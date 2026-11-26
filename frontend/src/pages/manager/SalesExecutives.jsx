import React, { useState, useEffect } from 'react';
import { Mail, UserPlus, X, Calendar } from 'lucide-react';
import { useDemoStore } from '../../context/DemoStoreContext';
import ExecutiveScheduleModal from '../../components/manager/ExecutiveScheduleModal';

export default function SalesExecutives() {
  const {
    users,
    executives: contextExecutives,
    visits,
    salons,
    addExecutive,
    isLoading,
    refreshAllData
  } = useDemoStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScheduleExec, setSelectedScheduleExec] = useState(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [modalError, setModalError] = useState('');

  // Auto-refresh executives data on mount
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  const executives =
    contextExecutives && contextExecutives.length > 0
      ? contextExecutives
      : users.filter((u) => u.role === 'executive');

  const handleOpenModal = () => {
    setFullName('');
    setEmail('');
    setPassword('');
    setModalError('');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalError('');
  };

  const handleCreateExecutive = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!fullName.trim() || !email.trim()) {
      setModalError('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setModalError('Password must be at least 6 characters long.');
      return;
    }

    const res = await addExecutive({
      name: fullName.trim(),
      email: email.trim().toLowerCase(),
      password
    });

    if (res?.success) {
      handleCloseModal();
    } else {
      setModalError(res?.error || 'Failed to create executive account.');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title & Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Sales Executives
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Assigned field representatives and core performance metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>+ Add Executive</span>
        </button>
      </div>

      {/* Simple List of Executives */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {executives.map((exec) => {
          const execVisits = visits.filter((v) => v.executive_id === exec.id);
          const assignedVisits = exec.assigned_visits ?? execVisits.length;
          const completedVisits =
            exec.completed_visits ?? execVisits.filter((v) => v.status === 'Completed').length;
          const conversions =
            exec.conversions ??
            salons.filter(
              (s) => s.assigned_executive_id === exec.id && s.lead_status === 'Converted'
            ).length;

          return (
            <div
              key={exec.id}
              className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4"
            >
              {/* Profile info: Name, Email */}
              <div className="border-b border-slate-100 pb-3">
                <div className="font-bold text-slate-900 text-base">
                  {exec.name || exec.full_name}
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{exec.email}</span>
                </div>
              </div>

              {/* Basic Performance Numbers: Assigned Visits, Completed Visits, Conversions */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                    Assigned
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {assignedVisits}
                  </span>
                </div>

                <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                  <span className="text-[10px] text-emerald-700 uppercase font-semibold block">
                    Completed
                  </span>
                  <span className="text-base font-bold text-emerald-700">
                    {completedVisits}
                  </span>
                </div>

                <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100">
                  <span className="text-[10px] text-indigo-700 uppercase font-semibold block">
                    Conversions
                  </span>
                  <span className="text-base font-bold text-indigo-700">
                    {conversions}
                  </span>
                </div>
              </div>

              {/* View Schedule / Calendar Button */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedScheduleExec(exec)}
                  className="w-full py-2 px-3 rounded-lg border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 text-indigo-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>View Schedule / Calendar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Executive Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Onboard Sales Executive
                  </h3>
                  <p className="text-xs text-slate-500">
                    Create a new field representative account
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            {modalError && (
              <div className="p-2.5 text-xs rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
                {modalError}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCreateExecutive} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikramaditya Rao"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. vikram@nyafaz-demo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Temporary Password <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Min 6 characters (e.g. Demo@123)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Must be at least 6 characters long.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg shadow-xs transition cursor-pointer"
                >
                  {isLoading ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* Executive Schedule Modal */}
      {selectedScheduleExec && (
        <ExecutiveScheduleModal
          isOpen={Boolean(selectedScheduleExec)}
          onClose={() => setSelectedScheduleExec(null)}
          executive={selectedScheduleExec}
        />
      )}

    </div>
  );
}
