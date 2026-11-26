import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  Check,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { useDemoStore } from '../../context/DemoStoreContext';
import ExecutiveScheduleModal from '../../components/manager/ExecutiveScheduleModal';
import { formatAddress } from '../../utils/address';

export default function TaskAssignment() {
  const {
    users,
    executives: contextExecutives,
    visits,
    salons,
    dailyAssignmentLimit,
    assignSalonTask,
    refreshAllData,
    isLoading
  } = useDemoStore();

  const [salonName, setSalonName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [assignedExecutiveId, setAssignedExecutiveId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Auto-refresh live data on page mount
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  const executives = useMemo(() => {
    if (contextExecutives && contextExecutives.length > 0) return contextExecutives;
    const execs = users.filter((u) => u.role === 'executive');
    return execs.length > 0 ? execs : users;
  }, [contextExecutives, users]);

  // Ensure default selected executive exists
  useEffect(() => {
    if (executives.length > 0 && !assignedExecutiveId) {
      setAssignedExecutiveId(executives[0].id);
    }
  }, [executives, assignedExecutiveId]);

  // Selected Executive details
  const selectedExec = useMemo(() => {
    return executives.find((e) => e.id === assignedExecutiveId) || executives[0];
  }, [executives, assignedExecutiveId]);

  // Compute existing visits for selected executive on chosen date
  const existingVisitsOnDate = useMemo(() => {
    const execId = assignedExecutiveId || selectedExec?.id;
    if (!execId || !date) return [];
    return visits
      .filter(
        (v) =>
          v.executive_id === execId &&
          v.scheduled_date === date &&
          v.status !== 'Cancelled'
      )
      .map((v) => {
        const s = salons.find((salon) => salon.salon_id === v.salon_id);
        return {
          ...v,
          salon_name: v.salon_name || s?.salon_name || 'Salon Outlet',
          address: formatAddress(v.address || s?.address, v.city || s?.city),
          visit_type: v.visit_type || 'Initial'
        };
      });
  }, [visits, salons, assignedExecutiveId, selectedExec, date]);

  const currentCountOnDate = existingVisitsOnDate.length;
  const followUpVisitsOnDate = existingVisitsOnDate.filter((v) => v.visit_type === 'Follow-up');
  const initialVisitsOnDate = existingVisitsOnDate.filter((v) => v.visit_type !== 'Follow-up');
  const isLimitReached = currentCountOnDate >= dailyAssignmentLimit;

  // Formatted date string (e.g. "Nov 26")
  const formattedDateStr = useMemo(() => {
    if (!date) return '';
    try {
      const [y, m, d] = date.split('-');
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return date;
    }
  }, [date]);

  // Live Daily Slot Breakdown text
  const slotSummaryText = useMemo(() => {
    const parts = [];
    if (followUpVisitsOnDate.length > 0) parts.push(`${followUpVisitsOnDate.length} Follow-up`);
    if (initialVisitsOnDate.length > 0) parts.push(`${initialVisitsOnDate.length} Initial`);
    const breakdown = parts.length > 0 ? parts.join(', ') : 'All slots available';
    return `${currentCountOnDate} / ${dailyAssignmentLimit} slots booked on ${formattedDateStr} — ${breakdown}`;
  }, [currentCountOnDate, dailyAssignmentLimit, formattedDateStr, followUpVisitsOnDate, initialVisitsOnDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmittedMessage('');
    setErrorMessage('');

    if (!salonName.trim()) {
      setErrorMessage('Please provide the Salon Name.');
      return;
    }

    if (!address.trim()) {
      setErrorMessage('Please provide the Address.');
      return;
    }

    if (!city.trim()) {
      setErrorMessage('Please provide the City.');
      return;
    }

    if (isLimitReached) {
      setErrorMessage(
        `Daily assignment limit reached: ${selectedExec?.name || selectedExec?.full_name} already has ${currentCountOnDate} of ${dailyAssignmentLimit} visits assigned on ${date}.`
      );
      return;
    }

    const execId = assignedExecutiveId || selectedExec?.id;
    const res = await assignSalonTask(
      {
        salon_name: salonName.trim(),
        address: address.trim(),
        city: city.trim()
      },
      execId,
      date
    );

    if (res?.success) {
      setSubmittedMessage(
        `Successfully allocated "${salonName}" to ${selectedExec?.name || selectedExec?.full_name} for ${date}.`
      );
      setSalonName('');
      setAddress('');
      setCity('');
      setErrorMessage('');
    } else {
      setErrorMessage(res?.error || 'Failed to assign task. Please try again.');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Assign Salon Task
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Create a salon lead and allocate a field visit to an executive.
        </p>
      </div>

      {/* Success Notification Banner */}
      {submittedMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{submittedMessage}</span>
          </div>
          <button
            onClick={() => setSubmittedMessage('')}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Backend / Validation Error Banner */}
      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage('')}
            className="text-rose-600 hover:text-rose-900 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      {/* Assignment Card Form */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 1. Salon Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Salon Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Elegance Hair Lounge"
              value={salonName}
              onChange={(e) => setSalonName(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* 2. Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Address <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. 100ft Road, Indiranagar"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* 3. City */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              City <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mumbai, Pune, Delhi..."
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* 4. Assign to Sales Executive & Schedule Link */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Assign To Sales Executive
              </label>
              {selectedExec && (
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>View Full Schedule</span>
                </button>
              )}
            </div>
            <select
              value={assignedExecutiveId}
              onChange={(e) => setAssignedExecutiveId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {executives.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.name || exec.full_name} ({exec.email})
                </option>
              ))}
            </select>
          </div>

          {/* 5. Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scheduled Date
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* 6. Live Daily Slot Indicator & Blocked Salons List */}
          <div
            className={`p-4 rounded-xl border text-xs space-y-3 transition ${
              isLimitReached
                ? 'bg-rose-50/70 border-rose-200 text-rose-900'
                : 'bg-slate-50 border-slate-200 text-slate-800'
            }`}
          >
            {/* Header with Slot Summary */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-xs block">
                  Daily Slot Indicator
                </span>
                <span className="text-[11px] opacity-90">
                  {slotSummaryText}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                  isLimitReached
                    ? 'bg-rose-200 text-rose-900 border border-rose-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                }`}
              >
                {currentCountOnDate} / {dailyAssignmentLimit} {isLimitReached ? 'FULL' : 'BOOKED'}
              </span>
            </div>

            {/* Visual 3-Slot Grid */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              {[0, 1, 2].map((slotIndex) => {
                const visitItem = existingVisitsOnDate[slotIndex];
                if (visitItem) {
                  const isFollowUp = visitItem.visit_type === 'Follow-up';
                  return (
                    <div
                      key={slotIndex}
                      className={`p-2 rounded-lg border text-center space-y-1 ${
                        isFollowUp
                          ? 'bg-purple-100/70 border-purple-300 text-purple-900'
                          : 'bg-blue-100/70 border-blue-300 text-blue-900'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider ${
                            isFollowUp
                              ? 'bg-purple-200 text-purple-800'
                              : 'bg-blue-200 text-blue-800'
                          }`}
                        >
                          {isFollowUp ? 'Follow-up' : 'Initial'}
                        </span>
                      </div>
                      <div className="font-bold truncate text-[11px]">
                        {visitItem.salon_name}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={slotIndex}
                    className="p-2 rounded-lg border border-dashed border-slate-300 bg-white/70 text-center flex flex-col items-center justify-center text-slate-400"
                  >
                    <span className="text-[10px] font-semibold">Slot {slotIndex + 1}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">Available</span>
                  </div>
                );
              })}
            </div>

            {/* Blocked Salons List */}
            {existingVisitsOnDate.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  Blocked Salons on this date ({existingVisitsOnDate.length})
                </span>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                  {existingVisitsOnDate.map((v) => {
                    const isFollowUp = v.visit_type === 'Follow-up';
                    return (
                      <div
                        key={v.id}
                        className={`p-2 rounded-lg border text-[11px] flex items-center justify-between gap-2 ${
                          isFollowUp
                            ? 'bg-purple-50 border-purple-200 text-purple-950'
                            : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                              isFollowUp
                                ? 'bg-purple-200 text-purple-800'
                                : 'bg-blue-200 text-blue-800'
                            }`}
                          >
                            {isFollowUp ? 'Follow-up' : 'Initial'}
                          </span>
                          <span className="font-semibold truncate">
                            {v.salon_name}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            v.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : v.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Full Capacity Warning */}
            {isLimitReached && (
              <div className="p-2.5 rounded-lg bg-rose-100 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium text-[11px]">
                  Daily limit reached (3 / 3 slots full). Please pick another date or executive to allocate this task.
                </span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLimitReached || isLoading}
            className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-white shadow-xs transition cursor-pointer ${
              isLimitReached || isLoading
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isLoading
              ? 'Assigning Task...'
              : isLimitReached
              ? 'Daily Limit Reached (3 / 3 Slots Booked)'
              : 'Assign Task'}
          </button>
        </form>
      </div>

      {/* Executive Schedule Drawer / Modal */}
      {selectedExec && (
        <ExecutiveScheduleModal
          isOpen={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          executive={selectedExec}
          onSelectDate={(chosenDate) => setDate(chosenDate)}
        />
      )}

    </div>
  );
}
