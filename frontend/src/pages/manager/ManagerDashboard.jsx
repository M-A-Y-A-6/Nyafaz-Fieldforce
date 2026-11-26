import React, { useEffect } from 'react';
import {
  Building2,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  DollarSign
} from 'lucide-react';
import { useDemoStore } from '../../context/DemoStoreContext';

export default function ManagerDashboard() {
  const {
    salons,
    users,
    visits,
    sales,
    dashboardSummary,
    refreshAllData
  } = useDemoStore();

  // Auto-refresh all live manager data on page mount
  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Read directly from live API-backed dashboardSummary (with array fallbacks)
  const totalSalons =
    dashboardSummary?.total_salons ??
    dashboardSummary?.totalSalons ??
    salons.length;

  const totalExecutives =
    dashboardSummary?.total_executives ??
    dashboardSummary?.totalExecutives ??
    users.filter((u) => u.role === 'executive').length;

  const completedVisits =
    dashboardSummary?.completed_visits ??
    dashboardSummary?.completedVisits ??
    visits.filter((v) => v.status === 'Completed').length;

  const pendingVisits =
    dashboardSummary?.pending_visits ??
    dashboardSummary?.pendingVisits ??
    visits.filter((v) => v.status === 'Pending' || v.status === 'In Progress').length;

  const convertedSalons =
    dashboardSummary?.converted_salons ??
    dashboardSummary?.convertedSalons ??
    salons.filter((s) => s.lead_status === 'Converted' || s.lead_status === 'Completed').length;

  const totalSales =
    dashboardSummary?.total_sales ??
    dashboardSummary?.totalSales ??
    sales.reduce((sum, s) => sum + (Number(s.total_amount) || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Manager Dashboard
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          High-level operational overview across your territory.
        </p>
      </div>

      {/* Clean Summary Cards showing ONLY the 6 requested metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* 1. Total Salons */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Salons</span>
            <Building2 className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalSalons}</div>
        </div>

        {/* 2. Total Executives */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Executives</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalExecutives}</div>
        </div>

        {/* 3. Completed Visits */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Completed Visits</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{completedVisits}</div>
        </div>

        {/* 4. Pending Visits */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Pending Visits</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600">{pendingVisits}</div>
        </div>

        {/* 5. Converted Salons */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Converted Salons</span>
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{convertedSalons}</div>
        </div>

        {/* 6. Total Sales */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Total Sales</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            ₹{Number(totalSales || 0).toLocaleString('en-IN')}
          </div>
        </div>

      </div>

    </div>
  );
}
