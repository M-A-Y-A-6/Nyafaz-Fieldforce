import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  MapPin,
  Clock,
  CheckCircle2,
  Sparkles,
  DollarSign,
  Search,
  User,
  Phone,
  Layers,
  Calendar,
  FileText
} from 'lucide-react';
import { useDemoStore } from '../../context/DemoStoreContext';
import { formatAddress } from '../../utils/address';
import { formatTime, formatDate } from '../../utils/dateTime';

const STATUS_TABS = ['All', 'Visit Scheduled', 'Visited', 'Interested', 'Completed'];

export default function SalonsReports() {
  const { salons, visits, refreshAllData } = useDemoStore();
  const [selectedTab, setSelectedTab] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-refresh live salons on mount
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Normalize each salon's lead status to the exact 4 target statuses
  const salonsList = useMemo(() => {
    return salons.map((salon) => {
      const salonVisits = visits.filter((v) => v.salon_id === salon.salon_id);
      const completedVisit = salonVisits.find((v) => v.status === 'Completed');
      const latestVisit = completedVisit || salonVisits[0] || salon.latest_visit;

      const raw = salon.lead_status || salon.raw_lead_status || 'Visit Scheduled';
      let normalizedStatus = 'Visit Scheduled';

      if (raw === 'Converted' || raw === 'Completed' || salon.has_sale || salon.sale) {
        normalizedStatus = 'Completed';
      } else if (raw === 'Interested' || raw === 'Proposal / Discussion') {
        normalizedStatus = 'Interested';
      } else if (raw === 'Visited' || raw === 'Not Interested' || raw === 'Lost') {
        normalizedStatus = 'Visited';
      } else {
        normalizedStatus = 'Visit Scheduled';
      }

      return {
        ...salon,
        lead_status: normalizedStatus,
        isCompleted: normalizedStatus === 'Completed',
        feedback: salon.feedback || completedVisit?.feedback || null,
        checkIn: salon.checkIn || salon.check_in || completedVisit?.check_in || null,
        checkOut: salon.checkOut || salon.check_out || completedVisit?.check_out || null,
        latestVisit
      };
    });
  }, [salons, visits]);

  // Counts for each filter tab
  const statusCounts = useMemo(() => {
    const counts = {
      All: salonsList.length,
      'Visit Scheduled': 0,
      Visited: 0,
      Interested: 0,
      Completed: 0
    };
    for (const s of salonsList) {
      if (counts[s.lead_status] !== undefined) {
        counts[s.lead_status]++;
      }
    }
    return counts;
  }, [salonsList]);

  // Filter salons by selected tab and search query
  const filteredSalons = useMemo(() => {
    return salonsList.filter((s) => {
      const matchesTab = selectedTab === 'All' || s.lead_status === selectedTab;
      if (!matchesTab) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const name = (s.salon_name || '').toLowerCase();
      const addr = (s.address || '').toLowerCase();
      const city = (s.city || '').toLowerCase();
      const exec = (s.assigned_executive_name || s.executive_name || '').toLowerCase();
      const owner = (s.owner_name || '').toLowerCase();
      const id = (s.salon_id || '').toLowerCase();

      return (
        name.includes(q) ||
        addr.includes(q) ||
        city.includes(q) ||
        exec.includes(q) ||
        owner.includes(q) ||
        id.includes(q)
      );
    });
  }, [salonsList, selectedTab, searchQuery]);

  // Distinct badge styling for each of the exact 4 statuses
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Completed</span>
          </span>
        );
      case 'Interested':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Interested</span>
          </span>
        );
      case 'Visited':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Visited</span>
          </span>
        );
      case 'Visit Scheduled':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Visit Scheduled</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Salons & Lead Status
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Master territory list showing each salon's live status, assigned sales executive, and visit feedback.
        </p>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        
        {/* Status Filter Tabs: All, Visit Scheduled, Visited, Interested, Completed */}
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_TABS.map((tab) => {
            const count = statusCounts[tab] || 0;
            const isActive = selectedTab === tab;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setSelectedTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive
                      ? 'bg-indigo-700 text-white'
                      : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search salons, city, executive..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-400 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition"
          />
        </div>

      </div>

      {/* Salons List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {filteredSalons.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">No salons found</p>
            <p className="text-xs text-slate-400">
              {searchQuery
                ? `No salons matching "${searchQuery}" under ${selectedTab}.`
                : `No salons currently with status "${selectedTab}".`}
            </p>
            {(selectedTab !== 'All' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedTab('All');
                  setSearchQuery('');
                }}
                className="mt-2 inline-flex items-center text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSalons.map((salon) => (
              <div
                key={salon.salon_id}
                className="p-5 flex flex-col lg:flex-row lg:items-start justify-between gap-6 hover:bg-slate-50/50 transition"
              >
                {/* Left Column: Salon Name, Status Badge, Address, Executive, Meta */}
                <div className="space-y-2.5 lg:max-w-sm w-full shrink-0">
                  
                  {/* Salon Name, ID & Status Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-sm">
                      {salon.salon_name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                      {salon.salon_id}
                    </span>
                    {renderStatusBadge(salon.lead_status)}
                  </div>

                  {/* Address */}
                  <div className="text-xs text-slate-600 flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>{formatAddress(salon.address, salon.city)}</span>
                  </div>

                  {/* Branches & Contact Info */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-slate-400" />
                      <span>{salon.num_branches || 1} Branch{(salon.num_branches || 1) > 1 ? 'es' : ''}</span>
                    </span>
                    {salon.contact_number && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{salon.contact_number}</span>
                      </span>
                    )}
                    {salon.owner_name && salon.owner_name !== 'Owner' && (
                      <span className="text-slate-400 truncate">
                        Owner: <strong className="text-slate-600">{salon.owner_name}</strong>
                      </span>
                    )}
                  </div>

                  {/* Assigned Executive */}
                  <div className="pt-1 text-[11px] font-medium flex items-center gap-1.5 text-slate-500 border-t border-slate-100">
                    <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Assigned to:</span>
                    <span className="text-slate-800 font-semibold">
                      {salon.assigned_executive_name || salon.executive_name || 'Unassigned'}
                    </span>
                  </div>

                </div>

                {/* Right Column: Feedback / Visit Status / Deal Highlights */}
                <div className="flex-1 bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 text-xs space-y-2.5">
                  
                  {/* Deal Closed / Converted Banner */}
                  {(salon.lead_status === 'Completed' || salon.sale) && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700">
                          <DollarSign className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-emerald-900 block">
                            Deal Closed & Converted
                          </span>
                          <span className="text-[11px] text-emerald-700">
                            Package: {salon.sale?.product_package || 'Professional Tier'}
                          </span>
                        </div>
                      </div>
                      {salon.sale?.total_amount && (
                        <div className="text-right">
                          <span className="text-sm font-extrabold text-emerald-700 block">
                            ₹{Number(salon.sale.total_amount).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-emerald-600">
                            {salon.sale.sales_date ? formatDate(salon.sale.sales_date) : 'Finalized'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Visit Feedback */}
                  {salon.feedback ? (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium text-[11px]">Visit Outcome:</span>
                          <strong className="text-slate-900 font-semibold text-xs">
                            {salon.feedback.visit_outcome}
                          </strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium text-[11px]">Customer Interest:</span>
                          <span className={`px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider ${
                            salon.feedback.customer_interest === 'High'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : salon.feedback.customer_interest === 'Medium'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {salon.feedback.customer_interest}
                          </span>
                        </div>
                      </div>

                      {salon.feedback.notes && (
                        <div>
                          <span className="text-slate-500 font-medium text-[11px] block mb-0.5">
                            Feedback Notes:
                          </span>
                          <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200/70 text-[11px] leading-relaxed">
                            "{salon.feedback.notes}"
                          </p>
                        </div>
                      )}

                      {salon.feedback.remarks && (
                        <div className="text-[11px] text-slate-600">
                          <span className="text-slate-500 font-medium">Remarks: </span>
                          <span>{salon.feedback.remarks}</span>
                        </div>
                      )}

                      {(salon.checkIn || salon.checkOut) && (
                        <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-500 pt-2 border-t border-slate-200/70">
                          {salon.checkIn && (
                            <span className="flex items-center gap-1 font-medium text-slate-600">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Check-In: {formatTime(salon.checkIn.time || salon.check_in_time)}</span>
                            </span>
                          )}
                          {salon.checkOut && (
                            <span className="flex items-center gap-1 font-medium text-slate-600">
                              <CheckCircle2 className="w-3 h-3 text-slate-400" />
                              <span>Check-Out: {formatTime(salon.checkOut.time || salon.check_out_time)}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-2 space-y-1 text-slate-500 text-xs">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="font-semibold text-slate-800">
                          Scheduled Task
                        </span>
                        {salon.scheduled_date && (
                          <span className="text-[11px] text-slate-500">
                            for {formatDate(salon.scheduled_date)}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Visit pending completion by assigned Sales Executive.
                      </p>
                    </div>
                  )}

                </div>

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
