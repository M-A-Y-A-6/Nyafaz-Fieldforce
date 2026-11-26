import React, { useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  CheckCircle,
  Lock,
  DollarSign
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

export default function DailyTasks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentUser,
    salons,
    visits,
    sales,
    checkInVisit,
    checkOutWithFeedback,
    updateSalonStatus,
    saveSalesDetails
  } = useDemoStore();

  const selectedDateStr = searchParams.get('date') || toLocalDateString(new Date());

  const selectedDateObj = useMemo(() => {
    try {
      const [year, month, day] = selectedDateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    } catch {
      return new Date();
    }
  }, [selectedDateStr]);

  const [feedbackVisit, setFeedbackVisit] = useState(null);
  const [salesSalon, setSalesSalon] = useState(null);
  const [bookNextVisitTarget, setBookNextVisitTarget] = useState(null);

  // Filter assigned salons for the executive on this day
  const assignedVisits = useMemo(() => {
    if (!currentUser) return [];
    return visits
      .filter((v) => v.executive_id === currentUser.id && v.scheduled_date === selectedDateStr)
      .map((v) => {
        const salon = salons.find((s) => s.salon_id === v.salon_id);
        const sale = sales.find((s) => s.salon_id === v.salon_id);
        const hasCheckedIn = Boolean(v.check_in_time || v.check_in?.time);
        const hasCheckedOut = Boolean(v.check_out_time || v.check_out?.time || v.status === 'Completed');
        const isInProgress = hasCheckedIn && !hasCheckedOut;
        
        // Before check-in: lead_status remains 'Visit Scheduled'
        const currentLeadStatus = hasCheckedIn
          ? (salon?.lead_status || v.lead_status || 'Visited')
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
          salon_name: v.salon_name || salon?.salon_name || 'Salon Outlet',
          address: formatAddress(salon?.address, salon?.city),
          lead_status: currentLeadStatus,
          associated_salon: salon,
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
  }, [currentUser, visits, salons, sales, selectedDateStr]);

  const handleShiftDate = (offsetDays) => {
    const next = new Date(selectedDateObj);
    next.setDate(next.getDate() + offsetDays);
    setSearchParams({ date: toLocalDateString(next) });
  };

  const handleToday = () => {
    setSearchParams({ date: toLocalDateString(new Date()) });
  };

  // Check-In Action
  const handleCheckIn = async (visit) => {
    const coords = await captureGpsPosition();
    await checkInVisit(visit.id, coords);
  };

  // Check-Out Action: captures GPS and opens feedback modal
  const handleCheckOut = async (visit) => {
    const coords = await captureGpsPosition();
    setFeedbackVisit({ ...visit, capturedCoords: coords });
  };

  // Feedback Submission
  const handleConfirmFeedback = async (feedbackData) => {
    if (!feedbackVisit) return { success: false };
    const res = await checkOutWithFeedback(feedbackVisit.id, feedbackData, feedbackVisit.capturedCoords);
    if (res && res.success !== false) {
      setFeedbackVisit(null);
      return { success: true };
    }
    return res || { success: false };
  };

  // Sales Details Submission
  const handleSaveSalesRecord = async (salesData) => {
    await saveSalesDetails(salesData);
    setSalesSalon(null);
  };

  // Status Dropdown change with lock rule
  const handleStatusChange = async (salonId, newStatus, hasSale) => {
    if (newStatus === 'Converted' && !hasSale) {
      const salon = salons.find((s) => s.salon_id === salonId);
      if (salon) setSalesSalon(salon);
      return;
    }
    await updateSalonStatus(salonId, newStatus);
  };

  return (
    <div className="space-y-6">
      
      {/* Date Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            Daily Tasks
          </h1>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {assignedVisits.length} Assigned
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleShiftDate(-1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Prev</span>
          </button>

          <span className="text-xs font-semibold text-slate-800 px-2">
            {selectedDateObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>

          <button
            onClick={() => handleShiftDate(1)}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold ml-1"
          >
            Today
          </button>
        </div>
      </div>

      {/* Salons List / Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {assignedVisits.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No salons assigned for this date.{' '}
            <Link to="/executive/calendar" className="text-indigo-600 font-semibold hover:underline">
              View Calendar
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {assignedVisits.map((item) => {
              const isPending = item.status === 'Pending';
              const isInProgress = item.status === 'In Progress';
              const isCompleted = item.status === 'Completed';

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                >
                  {/* 1. Salon Name & Address */}
                  <div className="space-y-1 min-w-[220px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">
                        {item.salon_name}
                      </span>
                      {item.isInProgress && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                          In Progress
                        </span>
                      )}
                      {item.isDealCompleted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.address}</span>
                      </div>
                      {getVisitTimeString(item) && (
                        <>
                          <span className="text-slate-300">•</span>
                          <div className="flex items-center gap-1 text-slate-500 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{getVisitTimeString(item)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions Row: Check-In, Check-Out, Book Next Visit, Status Dropdown, Sales Details */}
                  <div className="flex flex-wrap items-center gap-3">
                    
                    {/* 2. Check-In Button / Status */}
                    {!item.hasCheckedIn ? (
                      <button
                        onClick={() => handleCheckIn(item)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        Check-In
                      </button>
                    ) : (item.check_in || item.check_in_time) ? (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Checked In: {formatTime(item.check_in_time || item.check_in?.time)}</span>
                      </span>
                    ) : null}

                    {/* 3. Check-Out Button */}
                    {item.isInProgress ? (
                      <button
                        onClick={() => handleCheckOut(item)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                      >
                        Check-Out
                      </button>
                    ) : null}

                    {/* 4. Book Next Visit Button (When checked out & Lead is Interested / Proposal) */}
                    {item.canBookNextVisit && (
                      item.next_visit_booked ? (
                        <button
                          type="button"
                          disabled={true}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 border border-slate-200 text-xs font-semibold shadow-2xs flex items-center gap-1.5 cursor-not-allowed opacity-80"
                          title={`Next slot booked for ${item.bookedNextDate || 'scheduled date'}`}
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Booked Next Slot {item.bookedNextDate ? `(${item.bookedNextDate})` : ''}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setBookNextVisitTarget(item)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>Book Next Visit</span>
                        </button>
                      )
                    )}

                    {/* 5. Status Dropdown */}
                    <div className="flex items-center gap-1">
                      <select
                        value={item.lead_status}
                        onChange={(e) =>
                          handleStatusChange(item.salon_id, e.target.value, item.has_sale)
                        }
                        className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {LEAD_STATUS_OPTIONS.map((opt) => {
                          const isConverted = opt === 'Converted';
                          const isLocked = isConverted && !item.has_sale;

                          return (
                            <option key={opt} value={opt} disabled={isLocked}>
                              {isLocked ? 'Converted (Locked - Sale Required)' : opt}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* 6. Sales Details Button */}
                    <button
                      onClick={() => setSalesSalon(item.associated_salon)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1 cursor-pointer ${
                        item.has_sale
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>{item.has_sale ? 'Edit Sales Details' : 'Sales Details'}</span>
                    </button>

                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Feedback Modal */}
      {feedbackVisit && (
        <FeedbackModal
          isOpen={Boolean(feedbackVisit)}
          onClose={() => setFeedbackVisit(null)}
          visit={feedbackVisit}
          onConfirmFeedback={handleConfirmFeedback}
        />
      )}

      {/* Sales Details Modal */}
      {salesSalon && (
        <SalesDetailsModal
          isOpen={Boolean(salesSalon)}
          onClose={() => setSalesSalon(null)}
          salon={salesSalon}
          existingSale={sales.find((s) => s.salon_id === salesSalon.salon_id)}
          onSaveSalesRecord={handleSaveSalesRecord}
        />
      )}

      {/* Book Next Visit Modal */}
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
