import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import {
  INITIAL_USERS,
  INITIAL_SALONS,
  INITIAL_VISITS,
  INITIAL_SALES
} from '../data/mockData';

const DemoStoreContext = createContext(null);

const STORAGE_KEYS = {
  CURRENT_USER: 'nyafaz_demo_current_user_v1',
  TOKEN: 'access_token',
  LEGACY_TOKEN: 'token',
  ASSIGNMENT_LIMIT: 'nyafaz_demo_assignment_limit_v1'
};

export const DemoStoreProvider = ({ children }) => {
  // 1. Current User State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // 2. Data Collections
  const [users, setUsers] = useState(INITIAL_USERS);
  const [executives, setExecutives] = useState(() =>
    INITIAL_USERS.filter((u) => u.role === 'executive')
  );
  const [salons, setSalons] = useState(INITIAL_SALONS);
  const [visits, setVisits] = useState(INITIAL_VISITS);
  const [sales, setSales] = useState(INITIAL_SALES);
  const [dailyAssignmentLimit, setDailyAssignmentLimit] = useState(3);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // 3. Toast Notifications
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ id: Date.now(), message, type });
  }, []);

  const clearToast = useCallback(() => setToast(null), []);

  // Central Helper: Fetch All Live Data from Backend API in Parallel
  const refreshAllData = useCallback(async () => {
    const token =
      localStorage.getItem(STORAGE_KEYS.TOKEN) ||
      localStorage.getItem(STORAGE_KEYS.LEGACY_TOKEN);
    if (!token) return;

    try {
      setIsLoading(true);

      // Fetch Salons, Visits, Users, Dashboard Summary, and Sales in parallel
      const [salonsRes, visitsRes, usersRes, dashRes, salesRes] = await Promise.all([
        api.get('/salons').catch((err) => {
          console.warn('Failed to fetch salons:', err?.message || err);
          return null;
        }),
        api.get('/visits').catch((err) => {
          console.warn('Failed to fetch visits:', err?.message || err);
          return null;
        }),
        api.get('/users').catch((err) => {
          console.warn('Failed to fetch users:', err?.message || err);
          return null;
        }),
        api.get('/dashboard/summary').catch((err) => {
          console.warn('Failed to fetch dashboard summary:', err?.message || err);
          return null;
        }),
        api.get('/sales').catch((err) => {
          console.warn('Failed to fetch sales:', err?.message || err);
          return null;
        })
      ]);

      if (salonsRes?.data && Array.isArray(salonsRes.data)) {
        setSalons(salonsRes.data);
      }
      if (visitsRes?.data && Array.isArray(visitsRes.data)) {
        setVisits(visitsRes.data);
      }
      if (usersRes?.data && Array.isArray(usersRes.data)) {
        const mappedUsers = usersRes.data.map((u) => ({
          ...u,
          name: u.full_name || u.name
        }));
        setUsers(mappedUsers);
        setExecutives(mappedUsers.filter((u) => u.role === 'executive'));
      }
      if (dashRes?.data) {
        setDashboardSummary(dashRes.data);
      }
      if (salesRes?.data && Array.isArray(salesRes.data)) {
        setSales(salesRes.data);
      }
    } catch (err) {
      console.warn('Backend data synchronization error:', err?.message || err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Alias for backward compatibility
  const refreshData = refreshAllData;

  // Restore authenticated session on initial mount
  useEffect(() => {
    const initAuth = async () => {
      const token =
        localStorage.getItem(STORAGE_KEYS.TOKEN) ||
        localStorage.getItem(STORAGE_KEYS.LEGACY_TOKEN);
      if (!token) return;

      try {
        const meRes = await api.get('/auth/me');
        if (meRes.data) {
          const userObj = {
            ...meRes.data,
            name: meRes.data.full_name || meRes.data.name
          };
          setCurrentUser(userObj);
          localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userObj));
          await refreshAllData();
        }
      } catch {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
        localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        setCurrentUser(null);
      }
    };

    initAuth();
  }, [refreshAllData]);

  // Sync currentUser to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }, [currentUser]);

  // Login via Role (Quick Switcher with Seeded Demo Credentials)
  const loginAsRole = async (role) => {
    const credentials = {
      manager: { email: 'manager@nyafaz-demo.com', password: 'Demo@123' },
      executive: { email: 'priya@nyafaz-demo.com', password: 'Demo@123' }
    };

    const targetCred = credentials[role] || credentials.manager;
    return await loginWithCredentials(targetCred.email, targetCred.password);
  };

  // Login via email/password credentials against FastAPI POST /api/auth/login
  const loginWithCredentials = async (email, password) => {
    try {
      setIsLoading(true);
      const res = await api.post('/auth/login', {
        email: email.trim(),
        password
      });

      const { access_token, user } = res.data;
      const formattedUser = {
        ...user,
        name: user.full_name || user.name
      };

      // Persist auth tokens
      localStorage.setItem(STORAGE_KEYS.TOKEN, access_token);
      localStorage.setItem(STORAGE_KEYS.LEGACY_TOKEN, access_token);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(formattedUser));
      setCurrentUser(formattedUser);

      showToast(`Welcome back, ${formattedUser.name}!`, 'success');

      // Populate live collections
      await refreshAllData();

      return { success: true, user: formattedUser };
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Invalid email or password';
      showToast(errMsg, 'error');
      return { success: false, message: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Logout
  const logout = () => {
    const prevName = currentUser ? currentUser.name || currentUser.full_name : 'User';
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.LEGACY_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    setCurrentUser(null);
    showToast(`Goodbye ${prevName}. Logged out successfully.`, 'info');
  };

  // Onboard New Sales Executive (POST /api/users/executives)
  const addExecutive = async (executiveData) => {
    try {
      setIsLoading(true);
      const res = await api.post('/users/executives', {
        full_name: executiveData.name || executiveData.full_name,
        email: executiveData.email,
        password: executiveData.password || 'Demo@123'
      });

      const newExec = {
        ...res.data,
        name: res.data.full_name || res.data.name
      };

      await refreshAllData();
      showToast(`Executive "${newExec.name}" onboarded successfully!`, 'success');
      return { success: true, user: newExec };
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to create executive';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Allocate Salon Task (POST /api/visits/allocate)
  const assignSalonTask = async (salonIdOrData, executiveId, scheduledDate, scheduledTime = null) => {
    try {
      setIsLoading(true);
      let payload;

      if (typeof salonIdOrData === 'object' && salonIdOrData !== null) {
        payload = {
          salon_id: salonIdOrData.salon_id,
          salon_name: salonIdOrData.salon_name,
          address: salonIdOrData.address,
          city: salonIdOrData.city || '',
          owner_name: salonIdOrData.owner_name,
          contact_number: salonIdOrData.contact_number,
          num_branches: Number(salonIdOrData.num_branches) || 1,
          executive_id: executiveId,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime || null,
          salon_data: salonIdOrData
        };
      } else {
        payload = {
          salon_id: salonIdOrData,
          executive_id: executiveId,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime || null
        };
      }

      const res = await api.post('/visits/allocate', payload);
      await refreshAllData();
      showToast(`Task assigned successfully for ${scheduledDate}.`, 'success');
      return { success: true, visit: res.data.visit || res.data };
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to assign task';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Alias for backward compatibility
  const createAndAssignSalonTask = assignSalonTask;

  // Check In to a Visit (POST /api/visits/{id}/check-in)
  const checkInVisit = async (visitId, coords = null) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowDate = new Date().toISOString().split('T')[0];

    try {
      setIsLoading(true);
      const payload = {
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        time: coords?.time || nowTime,
        date: coords?.date || nowDate,
        status_text: coords?.status_text || (coords?.lat != null ? 'GPS Verified' : 'GPS Unavailable')
      };

      const res = await api.post(`/visits/${visitId}/check-in`, payload);
      await refreshAllData();
      showToast(`Checked in at ${nowTime}! (${payload.status_text})`, 'success');
      return res.data;
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Check-in failed';
      showToast(errMsg, 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Check Out with Detailed Feedback (POST /api/visits/{id}/check-out)
  const checkOutWithFeedback = async (visitId, feedbackData, coords = null) => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const nowDate = new Date().toISOString().split('T')[0];

    try {
      setIsLoading(true);
      const payload = {
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        time: coords?.time || nowTime,
        date: coords?.date || nowDate,
        status_text: coords?.status_text || (coords?.lat != null ? 'GPS Verified' : 'GPS Unavailable'),
        follow_up_date: feedbackData.follow_up_date || null,
        feedback: {
          visit_outcome: feedbackData.visit_outcome || 'Successful',
          customer_interest: feedbackData.customer_interest || 'High',
          notes: feedbackData.notes || '',
          remarks: feedbackData.remarks || '',
          lead_status: feedbackData.lead_status || undefined,
          follow_up_date: feedbackData.follow_up_date || null
        }
      };

      const res = await api.post(`/visits/${visitId}/check-out`, payload);
      await refreshAllData();
      showToast('Visit checkout recorded with feedback!', 'success');
      return { success: true, ...(res.data || {}) };
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Checkout failed';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Book Next Follow-Up Visit (POST /api/visits/book-next)
  const bookNextVisit = async (salonId, scheduledDate, scheduledTime = null, notes = '', originalVisitId = null) => {
    try {
      setIsLoading(true);
      const res = await api.post('/visits/book-next', {
        salon_id: salonId,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime || null,
        notes: notes || '',
        original_visit_id: originalVisitId || null
      });
      await refreshAllData();
      showToast(`Next visit scheduled for ${scheduledDate}!`, 'success');
      return { success: true, visit: res.data.visit || res.data };
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to book next visit';
      showToast(errMsg, 'error');
      return { success: false, error: errMsg };
    } finally {
      setIsLoading(false);
    }
  };

  // Update Salon Status & Assignment (PATCH /api/salons/{id}/status)
  const updateSalonStatus = async (salonId, newStatus, assignedExecutiveId = undefined) => {
    try {
      setIsLoading(true);
      const payload = {
        lead_status: newStatus,
        assigned_executive_id: assignedExecutiveId
      };

      const res = await api.patch(`/salons/${salonId}/status`, payload);
      await refreshAllData();
      showToast(`Salon status updated to "${newStatus}"`, 'info');
      return res.data;
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to update salon status';
      showToast(errMsg, 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Save Sales Record (POST /api/sales)
  const saveSalesDetails = async (salesData) => {
    try {
      setIsLoading(true);
      const payload = {
        salon_id: salesData.salon_id,
        salon_name: salesData.salon_name,
        product_package: salesData.product_package || 'Growth Package',
        num_branches: Number(salesData.num_branches) || 1,
        monthly_subscription: Number(salesData.monthly_subscription) || 0,
        implementation_charges: Number(salesData.implementation_charges) || 0,
        discount: Number(salesData.discount) || 0,
        gst: Number(salesData.gst) || 0,
        total_amount: Number(salesData.total_amount) || 0,
        sales_date: salesData.sales_date || new Date().toISOString().split('T')[0]
      };

      const res = await api.post('/sales', payload);
      await refreshAllData();
      showToast(
        `Sale recorded successfully! Total: ₹${Number(payload.total_amount).toLocaleString('en-IN')}`,
        'success'
      );
      return res.data;
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message || 'Failed to record sale';
      showToast(errMsg, 'error');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Update daily assignment limit
  const updateDailyAssignmentLimit = (newLimit) => {
    const val = Math.max(1, Number(newLimit) || 3);
    setDailyAssignmentLimit(val);
    showToast(`Daily assignment limit set to ${val} visits per executive.`, 'info');
  };

  // Reset Demo Data (re-fetches from backend)
  const resetDemoData = async () => {
    await refreshAllData();
    showToast('Data refreshed from backend API!', 'success');
  };

  return (
    <DemoStoreContext.Provider
      value={{
        // State
        currentUser,
        users,
        executives,
        salons,
        visits,
        sales,
        dailyAssignmentLimit,
        dashboardSummary,
        isLoading,
        toast,
        // Actions
        loginAsRole,
        loginWithCredentials,
        logout,
        addExecutive,
        assignSalonTask,
        createAndAssignSalonTask,
        checkInVisit,
        checkOutWithFeedback,
        bookNextVisit,
        updateSalonStatus,
        saveSalesDetails,
        updateDailyAssignmentLimit,
        resetDemoData,
        refreshAllData,
        refreshData,
        showToast,
        clearToast
      }}
    >
      {children}
    </DemoStoreContext.Provider>
  );
};

export const useDemoStore = () => {
  const context = useContext(DemoStoreContext);
  if (!context) {
    throw new Error('useDemoStore must be used within a DemoStoreProvider');
  }
  return context;
};
