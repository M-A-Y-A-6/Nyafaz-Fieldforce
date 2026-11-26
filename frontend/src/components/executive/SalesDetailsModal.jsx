import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';

const PACKAGES = [
  { name: 'Starter Package', baseMonthly: 3499, baseSetup: 5000 },
  { name: 'Growth Package', baseMonthly: 5999, baseSetup: 9000 },
  { name: 'Enterprise Package', baseMonthly: 8999, baseSetup: 15000 }
];

export default function SalesDetailsModal({
  isOpen,
  onClose,
  salon,
  existingSale,
  onSaveSalesRecord
}) {
  const [pkg, setPkg] = useState('Growth Package');
  const [numBranches, setNumBranches] = useState(1);
  const [monthlyPrice, setMonthlyPrice] = useState(5999);
  const [implementationCharges, setImplementationCharges] = useState(9000);
  const [discount, setDiscount] = useState(1000);
  const [gstRate, setGstRate] = useState(18);

  useEffect(() => {
    if (isOpen && salon) {
      if (existingSale) {
        setPkg(existingSale.product_package || 'Growth Package');
        setNumBranches(existingSale.num_branches || salon.num_branches || 1);
        setMonthlyPrice(existingSale.monthly_subscription ?? 5999);
        setImplementationCharges(existingSale.implementation_charges ?? 9000);
        setDiscount(existingSale.discount ?? 0);
      } else {
        setPkg('Growth Package');
        setNumBranches(salon.num_branches || 1);
        setMonthlyPrice(5999);
        setImplementationCharges(9000);
        setDiscount(1000);
      }
    }
  }, [isOpen, salon, existingSale]);

  if (!isOpen || !salon) return null;

  const handlePackageChange = (packageName) => {
    setPkg(packageName);
    const found = PACKAGES.find((p) => p.name === packageName);
    if (found) {
      setMonthlyPrice(found.baseMonthly);
      setImplementationCharges(found.baseSetup);
    }
  };

  // Live Auto-Calculation: ((Monthly Price * Branches) + Implementation - Discount) + GST
  const subtotal = Math.max(
    0,
    Number(monthlyPrice || 0) * Math.max(1, Number(numBranches || 1)) +
      Number(implementationCharges || 0) -
      Number(discount || 0)
  );
  const gstAmount = Number((subtotal * (Number(gstRate || 0) / 100)).toFixed(2));
  const totalAmount = Number((subtotal + gstAmount).toFixed(2));

  const handleSubmit = (e) => {
    e.preventDefault();

    onSaveSalesRecord({
      salon_id: salon.salon_id,
      salon_name: salon.salon_name,
      product_package: pkg,
      num_branches: Number(numBranches),
      monthly_subscription: Number(monthlyPrice),
      implementation_charges: Number(implementationCharges),
      discount: Number(discount),
      gst: gstAmount,
      total_amount: totalAmount,
      sales_date: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Sales Details
            </h3>
            <p className="text-xs text-slate-500">{salon.salon_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* 1. Package */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Package
            </label>
            <select
              value={pkg}
              onChange={(e) => handlePackageChange(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {PACKAGES.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} (₹{p.baseMonthly}/mo)
                </option>
              ))}
            </select>
          </div>

          {/* 2. Number of Branches */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Number of Branches
              </label>
              <input
                type="number"
                min="1"
                required
                value={numBranches}
                onChange={(e) => setNumBranches(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* 3. Monthly Price */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Monthly Price (₹)
              </label>
              <input
                type="number"
                min="0"
                required
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 4. Implementation Charges & 5. Discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Implementation Charges (₹)
              </label>
              <input
                type="number"
                min="0"
                value={implementationCharges}
                onChange={(e) => setImplementationCharges(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Discount (₹)
              </label>
              <input
                type="number"
                min="0"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* 6. GST */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              GST (18%): ₹{gstAmount.toLocaleString('en-IN')}
            </label>
          </div>

          {/* 7. Auto-Calculated Total Amount */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">Total Amount:</span>
            <span className="text-base font-extrabold text-emerald-600">
              ₹{totalAmount.toLocaleString('en-IN')}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-sm flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Convert</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
