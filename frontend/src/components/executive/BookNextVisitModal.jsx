import React, { useState, useMemo } from 'react';
import { X, Calendar as CalendarIcon, Clock, AlertCircle, Check } from 'lucide-react';
import { useDemoStore } from '../../context/DemoStoreContext';

export default function BookNextVisitModal({
  isOpen,
  onClose,
  visit,
  onSuccess
}) {
  const { visits, currentUser, bookNextVisit, dailyAssignmentLimit } = useDemoStore();

  // Tomorrow's date string as minimum date
  const tomorrowStr = useMemo(() => {
    return new Date(Date.now() + 86400000).toISOString().split('T')[0];
  }, []);

  const [date, setDate] = useState(tomorrowStr);
  const [time, setTime] = useState('11:00 AM');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Live count of existing visits for current executive on selected date
  const countOnDate = useMemo(() => {
    if (!currentUser || !date) return 0;
    return visits.filter(
      (v) =>
        v.executive_id === currentUser.id &&
        v.scheduled_date === date &&
        v.status !== 'Cancelled'
    ).length;
  }, [visits, currentUser, date]);

  const isLimitReached = countOnDate >= dailyAssignmentLimit;

  if (!isOpen || !visit) return null;

  const salonName = visit.salon_name || visit.associated_salon?.salon_name || 'Salon Outlet';
  const salonId = visit.salon_id;
  const leadStatus = visit.lead_status || visit.associated_salon?.lead_status || 'Interested';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!date) {
      setErrorMessage('Please select a date for the next visit.');
      return;
    }

    if (date < tomorrowStr) {
      setErrorMessage('Next visit date must be a future date.');
      return;
    }

    if (isLimitReached) {
      setErrorMessage(
        `You already have the maximum ${dailyAssignmentLimit} visits scheduled on this date. Please pick another follow-up date.`
      );
      return;
    }

    try {
      setSubmitting(true);
      const res = await bookNextVisit(salonId, date, time, notes, visit.id);
      if (res && res.success !== false) {
        if (onSuccess) onSuccess(res.visit);
        onClose();
      } else {
        setErrorMessage(res?.error || 'Failed to book next visit. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error booking next visit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                Book Next Visit
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                {leadStatus}
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {salonName}
            </h3>
            <p className="text-xs text-slate-500">
              Schedule your next meeting to continue discussions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* Scheduled Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Next Visit Date <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              min={tomorrowStr}
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setErrorMessage('');
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This date will be blocked on your calendar and visible to your manager.
            </p>
          </div>

          {/* Daily Slot Capacity Indicator */}
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
              isLimitReached
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-medium">
                {isLimitReached
                  ? 'Daily Limit Reached (3 / 3 Booked)'
                  : `${countOnDate} / ${dailyAssignmentLimit} visits booked on this date`}
              </span>
            </div>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                isLimitReached
                  ? 'bg-rose-200 text-rose-900'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isLimitReached ? 'FULL' : `${dailyAssignmentLimit - countOnDate} left`}
            </span>
          </div>

          {/* Scheduled Time */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scheduled Time
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="10:00 AM">10:00 AM</option>
              <option value="11:00 AM">11:00 AM</option>
              <option value="12:00 PM">12:00 PM</option>
              <option value="02:00 PM">02:00 PM</option>
              <option value="03:30 PM">03:30 PM</option>
              <option value="05:00 PM">05:00 PM</option>
            </select>
          </div>

          {/* Follow-up Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Next Visit Agenda / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Present customized contract, meet owner with branch manager..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || isLimitReached}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-xs font-semibold text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? 'Booking...'
                  : isLimitReached
                  ? 'Date Full (Max 3)'
                  : 'Confirm & Book Visit'}
              </span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
