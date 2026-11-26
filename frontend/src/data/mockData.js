/**
 * Nyafaz FieldForce - Simple Mock Data Seed
 * 1 Manager, 2 Executives, and 5 Salons
 */

export const getRelativeDate = (offsetDays = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

export const INITIAL_USERS = [
  {
    id: 'usr-mgr-1',
    name: 'Aarav Menon',
    email: 'manager@nyafaz-demo.com',
    role: 'manager'
  },
  {
    id: 'usr-exec-1',
    name: 'Priya Nair',
    email: 'priya@nyafaz-demo.com',
    role: 'executive'
  },
  {
    id: 'usr-exec-2',
    name: 'Rohan Verma',
    email: 'rohan@nyafaz-demo.com',
    role: 'executive'
  }
];

export const INITIAL_SALONS = [
  {
    salon_id: 'SAL-001',
    salon_name: 'Luxe Hair Lounge & Spa',
    address: '42, 80ft Road, 4th Block, Koramangala',
    city: 'Bengaluru',
    num_branches: 2,
    lead_status: 'Visit Scheduled',
    assigned_executive_id: 'usr-exec-1'
  },
  {
    salon_id: 'SAL-002',
    salon_name: 'Glow & Grace Unisex Salon',
    address: '108, 12th Main Road, Indiranagar',
    city: 'Bengaluru',
    num_branches: 1,
    lead_status: 'Interested',
    assigned_executive_id: 'usr-exec-1'
  },
  {
    salon_id: 'SAL-003',
    salon_name: 'Urban Shave & Grooming Studio',
    address: '24, Church Street, Ashok Nagar',
    city: 'Bengaluru',
    num_branches: 1,
    lead_status: 'Visited',
    assigned_executive_id: 'usr-exec-2'
  },
  {
    salon_id: 'SAL-004',
    salon_name: 'Aura Wellness & Hair Bar',
    address: '314, HSR Layout Sector 2, 27th Main',
    city: 'Bengaluru',
    num_branches: 3,
    lead_status: 'Converted',
    assigned_executive_id: 'usr-exec-1'
  },
  {
    salon_id: 'SAL-005',
    salon_name: 'Bliss Elegance Family Salon',
    address: '15/B, Outer Ring Road, Bellandur',
    city: 'Bengaluru',
    num_branches: 2,
    lead_status: 'Proposal / Discussion',
    assigned_executive_id: 'usr-exec-2'
  }
];

export const INITIAL_VISITS = [
  // Completed visit (Yesterday) for SAL-004
  {
    id: 'VIS-101',
    salon_id: 'SAL-004',
    salon_name: 'Aura Wellness & Hair Bar',
    executive_id: 'usr-exec-1',
    scheduled_date: getRelativeDate(-1),
    status: 'Completed',
    check_in: { time: '11:00 AM', status_text: 'GPS Verified' },
    check_out: { time: '12:30 PM', status_text: 'GPS Verified' },
    feedback: {
      visit_outcome: 'Successful',
      customer_interest: 'High',
      notes: 'Reviewed multi-outlet reporting. Contract signed for 3 branches.',
      remarks: 'Smooth closing. Onboarding next week.'
    }
  },
  // Completed visit (Yesterday) for SAL-003
  {
    id: 'VIS-102',
    salon_id: 'SAL-003',
    salon_name: 'Urban Shave & Grooming Studio',
    executive_id: 'usr-exec-2',
    scheduled_date: getRelativeDate(-1),
    status: 'Completed',
    check_in: { time: '03:30 PM', status_text: 'GPS Verified' },
    check_out: { time: '04:45 PM', status_text: 'GPS Verified' },
    feedback: {
      visit_outcome: 'Follow-up Required',
      customer_interest: 'Medium',
      notes: 'Demo given on tablet. Owner requested pricing proposal.',
      remarks: 'Follow up on Saturday.'
    }
  },
  // In Progress visit (Today) for Priya
  {
    id: 'VIS-103',
    salon_id: 'SAL-001',
    salon_name: 'Luxe Hair Lounge & Spa',
    executive_id: 'usr-exec-1',
    scheduled_date: getRelativeDate(0),
    status: 'In Progress',
    check_in: { time: '10:30 AM', status_text: 'GPS Verified' },
    check_out: null,
    feedback: null
  },
  // Pending visit (Today) for Priya
  {
    id: 'VIS-104',
    salon_id: 'SAL-002',
    salon_name: 'Glow & Grace Unisex Salon',
    executive_id: 'usr-exec-1',
    scheduled_date: getRelativeDate(0),
    status: 'Pending',
    check_in: null,
    check_out: null,
    feedback: null
  },
  // Tomorrow's planned visit for Rohan
  {
    id: 'VIS-105',
    salon_id: 'SAL-005',
    salon_name: 'Bliss Elegance Family Salon',
    executive_id: 'usr-exec-2',
    scheduled_date: getRelativeDate(1),
    status: 'Pending',
    check_in: null,
    check_out: null,
    feedback: null
  }
];

export const INITIAL_SALES = [
  {
    id: 'SALE-001',
    salon_id: 'SAL-004',
    salon_name: 'Aura Wellness & Hair Bar',
    executive_id: 'usr-exec-1',
    product_package: 'Enterprise Package',
    num_branches: 3,
    monthly_subscription: 8999,
    implementation_charges: 15000,
    discount: 2000,
    gst: 7199.46,
    total_amount: 47195.46,
    sales_date: getRelativeDate(-1)
  }
];

export const LEAD_STATUS_OPTIONS = [
  'New Lead',
  'Visit Scheduled',
  'Visited',
  'Interested',
  'Proposal / Discussion',
  'Converted',
  'Lost'
];
