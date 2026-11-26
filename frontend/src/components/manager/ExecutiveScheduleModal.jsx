import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  User,
  Mail,
  Plus
} from 'lucide-react';
import { useDemoStore } from '../../context/DemoStoreContext';
import { formatAddress } from '../../utils/address';
import { formatVisitScheduleTime } from '../../utils/dateTime';

export default function ExecutiveScheduleModal({
  isOpen,
  onClose,
  executive,
  onSelectDate
}) {
  const { visits, salons, dailyAssignmentLimit } = useDemoStore();
  const [statusFilter, setStatusFilter] = useState('all');

  if (!isOpen || !executive) return null;

  const execId = executive.id;
  const execName = executive.name || executive.full_name || 'Sales Executive';

  // Format time nicely using localized timestamps with zero hardcoded fallbacks
  const formatTimeDisplay = (v) => formatVisitScheduleTime(v);

  // Get all visits for this executive, strictly ordered latest to oldest (scheduled_date desc, created_at desc)
  const execVisits = useMemo(() => {
    return visits
      .filter((v) => v.executive_id === execId && v.status !== 'Cancelled')
      .map((v) => {
        const s = salons.find((salon) => salon.salon_id === v.salon_id);
        const hasCheckedIn = Boolean(v.check_in_time || v.check_in?.time);
        const hasCheckedOut = Boolean(v.check_out_time || v.check_out?.time || v.status === 'Completed');
        const isInProgress = hasCheckedIn && !hasCheckedOut;
        
        // Before check-in, salon's lead_status remains 'Visit Scheduled'
        const currentLeadStatus = hasCheckedIn
          ? (s?.lead_status || v.lead_status || 'Visited')
          : 'Visit Scheduled';
        
        // Deal Completed is true only when deal is converted
        const isDealCompleted = currentLeadStatus === 'Converted' || currentLeadStatus === 'Completed';

        return {
          ...v,
          salon_name: v.salon_name || s?.salon_name || 'Salon Outlet',
          address: formatAddress(v.address || s?.address, v.city || s?.city),
          lead_status: currentLeadStatus,
          hasCheckedIn,
          hasCheckedOut,
          isInProgress,
          isDealCompleted,
          created_at: v.created_at || ''
        };
      })
      .sort((a, b) => {
        // 1. scheduled_date descending (latest first)
        const dateDiff = new Date(b.scheduled_date) - new Date(a.scheduled_date);
        if (dateDiff !== 0) return dateDiff;
        // 2. created_at descending (latest first)
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
  }, [visits, salons, execId]);

  // Group visits by date, maintaining latest to oldest ordering
  const scheduleByDate = useMemo(() => {
    const groups = {};
    for (const v of execVisits) {
      const d = v.scheduled_date;
      if (!groups[d]) {
        groups[d] = [];
      }
      groups[d].push(v);
    }

    // Sort dates strictly descending (latest to oldest)
    return Object.keys(groups)
      .sort((a, b) => new Date(b) - new Date(a))
      .map((d) => {
        const dateVisits = groups[d];
        const isFull = dateVisits.length >= dailyAssignmentLimit;

        return {
          date: d,
          visits: dateVisits,
          count: dateVisits.length,
          isFull
        };
      });
  }, [execVisits, dailyAssignmentLimit]);

  // Filter if active
  const filteredSchedule = useMemo(() => {
    if (statusFilter === 'all') return scheduleByDate;
    return scheduleByDate
      .map((g) => ({
        ...g,
        visits: g.visits.filter((v) => {
          if (statusFilter === 'in_progress') return v.isInProgress;
          if (statusFilter === 'converted') return v.isDealCompleted;
          return v.lead_status === statusFilter;
        })
      }))
      .filter((g) => g.visits.length > 0);
  }, [scheduleByDate, statusFilter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                Executive Schedule
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {execVisits.length} Total Visits • Sorted Latest to Oldest
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              {execName}
            </h3>
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{executive.email}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
          <span className="font-semibold text-slate-500">Filter Schedule:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg font-medium">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({execVisits.length})
            </button>
            <button
              onClick={() => setStatusFilter('in_progress')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                statusFilter === 'in_progress'
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-blue-700'
              }`}
            >
              In Progress ({execVisits.filter((v) => v.isInProgress).length})
            </button>
            <button
              onClick={() => setStatusFilter('converted')}
              className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                statusFilter === 'converted'
                  ? 'bg-emerald-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              Completed ({execVisits.filter((v) => v.isDealCompleted).length})
            </button>
          </div>
        </div>

        {/* Scheduled Dates List (Latest to Oldest) */}
        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {filteredSchedule.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              No visits found for this executive.
            </div>
          ) : (
            filteredSchedule.map((group) => {
              const dateObj = new Date(group.date + 'T00:00:00');
              const formattedDate = dateObj.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });

              return (
                <div
                  key={group.date}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3"
                >
                  {/* Date Heading */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-indigo-600" />
                      <span className="font-bold text-slate-900 text-xs">
                        {formattedDate}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        ({group.date})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          group.isFull
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {group.count} / {dailyAssignmentLimit} Slots {group.isFull ? '(FULL)' : 'Booked'}
                      </span>

                      {onSelectDate && !group.isFull && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectDate(group.date);
                            onClose();
                          }}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer ml-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Assign</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visit Rows (No Pending, No Follow-up, No Initial badges) */}
                  <div className="space-y-2">
                    {group.visits.map((v) => {
                      return (
                        <div
                          key={v.id}
                          className="p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50 transition"
                        >
                          {/* Salon Name & Address */}
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="font-bold text-slate-900 truncate text-[13px]">
                              {v.salon_name}
                            </div>

                            {/* Scheduled Date & Time (or check-in/out time if available) */}
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                              <span className="flex items-center gap-1 text-slate-600">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{formatTimeDisplay(v)}</span>
                              </span>
                              <span>•</span>
                              <span className="truncate max-w-[260px] text-slate-500">
                                {v.address}
                              </span>
                            </div>
                          </div>

                          {/* Right Side: Lead Status & Only In Progress / Completed badges */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            
                            {/* Current Lead Status */}
                            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white text-slate-800 border border-slate-200 shadow-2xs">
                              {v.lead_status}
                            </span>

                            {/* In Progress badge: ONLY when checked in and not checked out */}
                            {v.isInProgress && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                                In Progress
                              </span>
                            )}

                            {/* Completed badge: ONLY when deal is converted */}
                            {v.isDealCompleted && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Completed
                              </span>
                            )}

                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Daily capacity rule: Maximum {dailyAssignmentLimit} visits per executive per day.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 font-semibold text-slate-700 cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
