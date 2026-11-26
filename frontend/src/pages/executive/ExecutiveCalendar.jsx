import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  MapPin,
  Clock,
  CheckCircle2,
  DollarSign,
  X,
  Check,
  Navigation,
  FileText,
  ArrowRight
} from 'lucide-react';
import { useDemoStore } from '../../context/DemoStoreContext';
import { LEAD_STATUS_OPTIONS } from '../../data/mockData';
import FeedbackModal from '../../components/executive/FeedbackModal';
import SalesDetailsModal from '../../components/executive/SalesDetailsModal';
import BookNextVisitModal from '../../components/executive/BookNextVisitModal';
import { formatAddress } from '../../utils/address';
import { formatTime, getVisitTimeString } from '../../utils/dateTime';

const toLocalDateString = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDay = (d1, d2) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

// Graceful GPS coordinate capture
const captureGpsPosition = () => {
  return new Promise((resolve) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date().toISOString().split('T')[0];

    if (!('geolocation' in navigator)) {
      resolve({ lat: null, lng: null, time: timeStr, date: dateStr, status_text: 'GPS Unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: Number(pos.coords.latitude.toFixed(5)),
          lng: Number(pos.coords.longitude.toFixed(5)),
          time: timeStr,
          date: dateStr,
          status_text: 'GPS Verified'
        });
      },
      () => {
        resolve({ lat: null, lng: null, time: timeStr, date: dateStr, status_text: 'GPS Unavailable' });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  });
};

export default function ExecutiveCalendar() {
  const navigate = useNavigate();
  const {
    currentUser,
    visits,
    salons,
    sales,
    checkInVisit,
    checkOutWithFeedback,
    updateSalonStatus,
    saveSalesDetails
  } = useDemoStore();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const today = useMemo(() => new Date(), []);

  // Single-Task Detail Selection
  const [selectedVisitId, setSelectedVisitId] = useState(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [feedbackVisit, setFeedbackVisit] = useState(null);
  const [salesSalon, setSalesSalon] = useState(null);
  const [bookNextVisitTarget, setBookNextVisitTarget] = useState(null);

  // Compute 7 days for the current week (Monday through Sunday)
  const weekDays = useMemo(() => {
    const days = [];
    const anchor = new Date(currentDate);
    const dayOfWeek = anchor.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - distanceToMonday);

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Executive visits enriched with salon and sale info
  const myVisits = useMemo(() => {
    if (!currentUser) return [];
    return visits
      .filter((v) => v.executive_id === currentUser.id)
      .map((v) => {
        const s = salons.find((item) => item.salon_id === v.salon_id);
        const sale = sales.find((item) => item.salon_id === v.salon_id);
        const hasCheckedIn = Boolean(v.check_in_time || v.check_in?.time);
        const hasCheckedOut = Boolean(v.check_out_time || v.check_out?.time || v.status === 'Completed');
        const isInProgress = hasCheckedIn && !hasCheckedOut;
        
        // Before check-in: salon's lead_status remains 'Visit Scheduled'
        const currentLeadStatus = hasCheckedIn
          ? (s?.lead_status || v.lead_status || 'Visited')
          : 'Visit Scheduled';
        
        // Deal Completed is true only when deal is converted
        const isDealCompleted = currentLeadStatus === 'Converted' || currentLeadStatus === 'Completed';
        const canBookNextVisit = hasCheckedOut && (currentLeadStatus === 'Interested' || currentLeadStatus === 'Proposal / Discussion');

        // Check if next visit is already booked
        const futureFollowUp = visits.find((other) =>
          other.id !== v.id &&
          other.salon_id === v.salon_id &&
          (other.status === 'Pending' || other.status === 'In Progress' || other.scheduled_date > v.scheduled_date)
        );
        const next_visit_booked = Boolean(v.next_visit_booked || v.follow_up_date || futureFollowUp);
        const bookedNextDate = v.follow_up_date || futureFollowUp?.scheduled_date || null;

        return {
          ...v,
          salon_name: v.salon_name || s?.salon_name || 'Salon Outlet',
          salon_id: v.salon_id,
          address: formatAddress(s?.address, s?.city),
          lead_status: currentLeadStatus,
          associated_salon: s,
          has_sale: Boolean(sale),
          sale,
          hasCheckedIn,
          hasCheckedOut,
          isInProgress,
          isDealCompleted,
          canBookNextVisit,
          next_visit_booked,
          bookedNextDate
        };
      });
  }, [currentUser, visits, salons, sales]);

  // Single active visit for detail modal
  const selectedVisit = useMemo(() => {
    if (!selectedVisitId) return null;
    return myVisits.find((v) => v.id === selectedVisitId) || null;
  }, [selectedVisitId, myVisits]);

  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() - 7);
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + 7);
      return next;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClick = (dateStr) => {
    navigate(`/executive/tasks?date=${dateStr}`);
  };

  // Check-In Action
  const handleCheckIn = async (visit) => {
    try {
      setIsCheckingIn(true);
      const coords = await captureGpsPosition();
      await checkInVisit(visit.id, coords);
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Check-Out Action (captures GPS and triggers FeedbackModal)
  const handleCheckOut = async (visit) => {
    const coords = await captureGpsPosition();
    setFeedbackVisit({ ...visit, capturedCoords: coords });
  };

  // Submit Feedback from FeedbackModal
  const handleConfirmFeedback = async (feedbackData) => {
    if (!feedbackVisit) return { success: false };
    const res = await checkOutWithFeedback(feedbackVisit.id, feedbackData, feedbackVisit.capturedCoords);
    if (res && res.success !== false) {
      setFeedbackVisit(null);
      return { success: true };
    }
    return res || { success: false };
  };

  // Submit Sales details from SalesDetailsModal
  const handleSaveSalesRecord = async (salesData) => {
    await saveSalesDetails(salesData);
    setSalesSalon(null);
  };

  // Open Sales Modal
  const handleOpenSalesModal = (visit) => {
    if (visit.associated_salon) {
      setSalesSalon(visit.associated_salon);
    }
  };

  // Lead Status Change with Converted Lock Rule
  const handleStatusChange = async (salonId, newStatus, hasSale) => {
    if (newStatus === 'Converted' && !hasSale) {
      const salon = salons.find((s) => s.salon_id === salonId);
      if (salon) setSalesSalon(salon);
      return;
    }
    await updateSalonStatus(salonId, newStatus);
  };

  // Header range formatting
  const headerText = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [weekDays]);

  return (
    <div className="space-y-6">
      
      {/* Top Header & Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-indigo-600" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Assigned Salons Calendar
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrev}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>
          
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition"
          >
            Today
          </button>

          <button
            onClick={handleNext}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1 cursor-pointer transition"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <span className="text-xs font-semibold text-slate-700 pl-2">
            {headerText}
          </span>
        </div>
      </div>

      {/* Clean 7-Day Grid */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        
        {/* Day Name Header Row */}
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center divide-x divide-slate-200">
          {weekDays.map((d) => {
            const isDayToday = isSameDay(d, today);
            return (
              <div key={d.toISOString()} className="py-2.5 px-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span
                  className={`inline-block mt-0.5 text-xs font-bold w-6 h-6 leading-6 rounded-full ${
                    isDayToday ? 'bg-indigo-600 text-white' : 'text-slate-800'
                  }`}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {/* 7 Columns: Each assigned task is individually clickable */}
        <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 min-h-[380px]">
          {weekDays.map((dateObj) => {
            const dateStr = toLocalDateString(dateObj);
            const isDayToday = isSameDay(dateObj, today);
            const dayVisits = myVisits.filter((v) => v.scheduled_date === dateStr);

            return (
              <div
                key={dateStr}
                onClick={() => handleDateClick(dateStr)}
                className={`p-2.5 space-y-2 cursor-pointer transition hover:bg-indigo-50/20 ${
                  isDayToday ? 'bg-indigo-50/15' : 'bg-white'
                }`}
                title={`Click date to open Daily Tasks for ${dateStr}`}
              >
                {/* Mobile Day Indicator */}
                <div className="sm:hidden flex items-center justify-between font-semibold text-xs text-slate-700 pb-1 border-b border-slate-100">
                  <span>
                    {dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  {isDayToday && <span className="text-indigo-600 font-bold">Today</span>}
                </div>

                {/* Salon Task Cards */}
                {dayVisits.length === 0 ? (
                  <div className="h-16 flex items-center justify-center text-[11px] text-slate-400 italic">
                    No salons
                  </div>
                ) : (
                  dayVisits.map((v) => {
                    const isPending = v.status === 'Pending';
                    const isInProgress = v.status === 'In Progress';
                    const isCompleted = v.status === 'Completed';

                    return (
                      <div
                        key={v.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVisitId(v.id);
                        }}
                        className={`p-2.5 rounded-lg border text-xs shadow-2xs transition cursor-pointer group text-left ${
                          v.isDealCompleted
                            ? 'bg-emerald-50/80 hover:bg-emerald-100/90 border-emerald-200/90 text-emerald-950'
                            : v.isInProgress
                            ? 'bg-blue-50/80 hover:bg-blue-100/90 border-blue-200/90 text-blue-950'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                        title="Click to view single task details & actions"
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="font-bold truncate text-[12px] group-hover:text-indigo-700">
                            {v.salon_name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {v.isInProgress && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                                In Progress
                              </span>
                            )}
                            {v.isDealCompleted && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Completed
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between">
                          <span>{getVisitTimeString(v)}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[90px]">
                            {v.lead_status}
                          </span>
                        </div>
                        {v.canBookNextVisit && (
                          v.next_visit_booked ? (
                            <button
                              type="button"
                              disabled={true}
                              className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-semibold cursor-not-allowed opacity-80"
                              title={`Next slot booked for ${v.bookedNextDate || 'scheduled date'}`}
                            >
                              <CalendarIcon className="w-3 h-3 text-slate-400" />
                              <span>Booked Next Slot</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBookNextVisitTarget(v);
                              }}
                              className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 px-1.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-semibold transition cursor-pointer"
                            >
                              <CalendarIcon className="w-3 h-3 text-indigo-600" />
                              <span>Book Next Visit</span>
                            </button>
                          )
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Single-Task Detail Modal / Slide-Over */}
      {selectedVisit && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setSelectedVisitId(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {selectedVisit.salon_id}
                  </span>
                  {selectedVisit.isInProgress && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                      In Progress
                    </span>
                  )}
                  {selectedVisit.isDealCompleted && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Completed
                    </span>
                  )}
                  {!selectedVisit.isInProgress && !selectedVisit.isDealCompleted && (
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {selectedVisit.lead_status}
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedVisit.salon_name}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedVisitId(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer transition hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Salon Details Section */}
            <div className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-xl space-y-2.5 text-xs">
              <div className="flex items-start gap-2 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>{selectedVisit.address}</span>
              </div>
              <div className="flex items-center gap-4 text-slate-600 pt-1 border-t border-slate-200/60">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-800">
                    {selectedVisit.scheduled_date}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium text-slate-800">
                    {getVisitTimeString(selectedVisit) || 'All Day'}
                  </span>
                </div>
              </div>
              {selectedVisit.follow_up_date && (
                <div className="flex items-center gap-1.5 text-purple-700 pt-1 border-t border-slate-200/60 font-medium">
                  <CalendarIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span>Next Follow-up Booked: {selectedVisit.follow_up_date}</span>
                </div>
              )}
            </div>

            {/* Lead Status Row */}
            <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl">
              <div>
                <span className="text-xs font-semibold text-slate-700 block">Lead Status</span>
                <span className="text-[11px] text-slate-400">Current sales pipeline stage</span>
              </div>

              {selectedVisit.hasCheckedIn || selectedVisit.hasCheckedOut || selectedVisit.status === 'In Progress' || selectedVisit.status === 'Completed' ? (
                <select
                  value={selectedVisit.lead_status}
                  onChange={(e) =>
                    handleStatusChange(
                      selectedVisit.salon_id,
                      e.target.value,
                      selectedVisit.has_sale
                    )
                  }
                  className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {LEAD_STATUS_OPTIONS.map((opt) => {
                    const isConverted = opt === 'Converted';
                    const isLocked = isConverted && !selectedVisit.has_sale;
                    return (
                      <option key={opt} value={opt} disabled={isLocked}>
                        {isLocked ? 'Converted (Locked - Sale Required)' : opt}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold">
                  {selectedVisit.lead_status}
                </span>
              )}
            </div>

            {/* Task-Specific Action Controls */}
            <div className="space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Task Actions
              </span>

              {/* 1. Pending: Check-In with GPS */}
              {selectedVisit.status === 'Pending' && (
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
                    <Navigation className="w-4 h-4 text-amber-600" />
                    <span>Visit Not Started</span>
                  </div>
                  <p className="text-xs text-amber-700">
                    Check in with your GPS coordinates upon arrival to begin this visit.
                  </p>
                  <button
                    type="button"
                    disabled={isCheckingIn}
                    onClick={() => handleCheckIn(selectedVisit)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5" />
                    <span>{isCheckingIn ? 'Capturing GPS & Checking In...' : 'Check In with GPS'}</span>
                  </button>
                </div>
              )}

              {/* 2. In Progress: Check-Out, Feedback, and Sales Details */}
              {selectedVisit.status === 'In Progress' && (
                <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-blue-200/60">
                    <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Checked In: {formatTime(selectedVisit.check_in_time || selectedVisit.check_in?.time) || 'Recorded'}
                    </span>
                    <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                      {selectedVisit.check_in?.status_text || 'GPS Verified'}
                    </span>
                  </div>

                  <p className="text-xs text-blue-800">
                    Record client feedback upon meeting completion or record sales details if a package is purchased.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleCheckOut(selectedVisit)}
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Check Out & Feedback</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenSalesModal(selectedVisit)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-semibold border shadow-xs transition cursor-pointer ${
                        selectedVisit.has_sale
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{selectedVisit.has_sale ? 'Edit Sales Details' : 'Fill Sales Details'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Completed: Read-Only Summary & Sales Record */}
              {selectedVisit.status === 'Completed' && (
                <div className="space-y-3">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Visit Completed
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      {selectedVisit.check_out_time || selectedVisit.check_out?.time
                        ? `Checked out at ${formatTime(selectedVisit.check_out_time || selectedVisit.check_out?.time)}`
                        : 'Done'}
                    </span>
                  </div>

                  {/* Visit Feedback Summary */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                    <div className="font-bold text-slate-800 border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Visit Summary & Feedback</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-slate-600">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">OUTCOME</span>
                        <span className="font-medium text-slate-800">
                          {selectedVisit.feedback?.visit_outcome || selectedVisit.visit_outcome || 'Successful'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">CUSTOMER INTEREST</span>
                        <span className="font-medium text-slate-800">
                          {selectedVisit.feedback?.customer_interest || selectedVisit.customer_interest || 'High'}
                        </span>
                      </div>
                    </div>

                    {(selectedVisit.check_in || selectedVisit.check_out || selectedVisit.check_in_time || selectedVisit.check_out_time) && (
                      <div className="grid grid-cols-2 gap-2 text-slate-600 pt-1.5 border-t border-slate-200/60">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">CHECK-IN</span>
                          <span className="font-medium text-slate-800">
                            {formatTime(selectedVisit.check_in_time || selectedVisit.check_in?.time) || '—'} {selectedVisit.check_in?.status_text ? `(${selectedVisit.check_in.status_text})` : ''}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-semibold">CHECK-OUT</span>
                          <span className="font-medium text-slate-800">
                            {formatTime(selectedVisit.check_out_time || selectedVisit.check_out?.time) || '—'} {selectedVisit.check_out?.status_text ? `(${selectedVisit.check_out.status_text})` : ''}
                          </span>
                        </div>
                      </div>
                    )}

                    {(selectedVisit.feedback?.notes || selectedVisit.notes) && (
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 block font-semibold">FEEDBACK NOTES</span>
                        <p className="text-slate-700 mt-0.5 whitespace-pre-wrap">
                          {selectedVisit.feedback?.notes || selectedVisit.notes}
                        </p>
                      </div>
                    )}

                    {(selectedVisit.feedback?.remarks || selectedVisit.remarks) && (
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400 block font-semibold">REMARKS</span>
                        <p className="text-slate-700 mt-0.5">
                          {selectedVisit.feedback?.remarks || selectedVisit.remarks}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Recorded Sale Information */}
                  {selectedVisit.has_sale && selectedVisit.sale && (
                    <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-emerald-900 flex items-center gap-1">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          Sale Recorded
                        </span>
                        <span className="font-extrabold text-emerald-700 text-sm">
                          ₹{Number(selectedVisit.sale.total_amount).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-800 flex items-center justify-between">
                        <span>Package: {selectedVisit.sale.product_package}</span>
                        <span>{selectedVisit.sale.num_branches} Branch(es)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenSalesModal(selectedVisit)}
                        className="w-full mt-1 py-1.5 text-center text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-300 rounded-lg transition cursor-pointer"
                      >
                        View / Edit Sales Record
                      </button>
                    </div>
                  )}

                  {/* Book Next Visit Button (When checked out & Lead is Interested / Proposal) */}
                  {selectedVisit.canBookNextVisit && (
                    <div className="pt-2">
                      {selectedVisit.next_visit_booked ? (
                        <button
                          type="button"
                          disabled={true}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold shadow-2xs cursor-not-allowed opacity-80"
                        >
                          <CalendarIcon className="w-4 h-4 text-slate-400" />
                          <span>Booked Next Slot {selectedVisit.bookedNextDate ? `(${selectedVisit.bookedNextDate})` : ''}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setBookNextVisitTarget(selectedVisit)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          <CalendarIcon className="w-4 h-4" />
                          <span>Book Next Visit</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate(`/executive/tasks?date=${selectedVisit.scheduled_date}`)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>View all tasks for {selectedVisit.scheduled_date}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedVisitId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Reusable Feedback Modal */}
      {feedbackVisit && (
        <FeedbackModal
          isOpen={Boolean(feedbackVisit)}
          onClose={() => setFeedbackVisit(null)}
          visit={feedbackVisit}
          onConfirmFeedback={handleConfirmFeedback}
        />
      )}

      {/* Reusable Sales Details Modal */}
      {salesSalon && (
        <SalesDetailsModal
          isOpen={Boolean(salesSalon)}
          onClose={() => setSalesSalon(null)}
          salon={salesSalon}
          existingSale={sales.find((s) => s.salon_id === salesSalon.salon_id)}
          onSaveSalesRecord={handleSaveSalesRecord}
        />
      )}

      {/* Reusable Book Next Visit Modal */}
      {bookNextVisitTarget && (
        <BookNextVisitModal
          isOpen={Boolean(bookNextVisitTarget)}
          onClose={() => setBookNextVisitTarget(null)}
          visit={bookNextVisitTarget}
        />
      )}

    </div>
  );
}
