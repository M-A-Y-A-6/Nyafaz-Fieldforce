import React, { useState } from 'react';
import { X, Check, Calendar, AlertCircle } from 'lucide-react';

export default function FeedbackModal({
  isOpen,
  onClose,
  visit,
  onConfirmFeedback
}) {
  const [outcome, setOutcome] = useState('Successful');
  const [interest, setInterest] = useState('High');
  const [notes, setNotes] = useState('');
  const [remarks, setRemarks] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen || !visit) return null;

  // Calculate tomorrow's date string for min date boundary
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!notes.trim()) {
      setErrorMessage('Please enter feedback notes.');
      return;
    }

    if (outcome === 'Follow-up Required' && !followUpDate) {
      setErrorMessage('Please select a follow-up visit date.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await onConfirmFeedback({
        visit_outcome: outcome,
        customer_interest: interest,
        notes: notes.trim(),
        remarks: remarks.trim(),
        follow_up_date: outcome === 'Follow-up Required' ? followUpDate : null
      });

      if (res && res.success === false) {
        setErrorMessage(res.error || 'Failed to complete visit. Please choose another date or check your connection.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to complete checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Visit Feedback
            </h3>
            <p className="text-xs text-slate-500">{visit.salon_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* 1. Visit Outcome */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Visit Outcome
            </label>
            <select
              value={outcome}
              onChange={(e) => {
                setOutcome(e.target.value);
                setErrorMessage('');
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="Successful">Successful</option>
              <option value="Follow-up Required">Follow-up Required</option>
              <option value="Not Available">Not Available</option>
            </select>
          </div>

          {/* Follow-up Visit Date (Mandatory when Outcome is Follow-up Required) */}
          {outcome === 'Follow-up Required' && (
            <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl space-y-1.5 animate-in fade-in duration-150">
              <label className="block text-xs font-semibold text-purple-900">
                Follow-up Visit Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  min={tomorrowStr}
                  value={followUpDate}
                  onChange={(e) => {
                    setFollowUpDate(e.target.value);
                    setErrorMessage('');
                  }}
                  className="w-full bg-white border border-purple-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                />
              </div>
              <p className="text-[11px] text-purple-700 font-medium">
                This date will be blocked on your calendar and visible to your manager.
              </p>
            </div>
          )}

          {/* 2. Customer Interest */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Customer Interest
            </label>
            <select
              value={interest}
              onChange={(e) => setInterest(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* 3. Feedback Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Feedback Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Enter meeting notes and salon requirements..."
              className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* 4. Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Any additional remarks..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400"
            />
          </div>

          {/* Buttons */}
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
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit & Complete'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
