import React, { useState, useEffect } from 'react';
import api from '../../utils/api';

import { toast } from 'react-toastify';
import { Eye } from 'lucide-react';
import LeaveDetailsModal from '../../components/LeaveDetailsModal';
import DateInput from '../../components/DateInput';

const LeaveRequestPage = ({ employeeId, leaveBalance, onLeaveRequestSuccess }) => {
  const [formData, setFormData] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    daysCount: 0,
    sessionData: {}, // { "2024-02-24": "FULL", "2024-02-25": "MORNING" }
  });
  const [blockedDates, setBlockedDates] = useState([]);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [leaveHistory, setLeaveHistory] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState([]);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [joiningDate, setJoiningDate] = useState(null);
  const [timesheets, setTimesheets] = useState([]);
  const [dateError, setDateError] = useState(false);

  // Fetch all leaves for this employee
  const fetchLeaveHistory = async () => {
    if (!employeeId) return;
    setHistoryLoading(true);
    try {
      const response = await api(`/api/leaves/employee/${employeeId}`);
      const data = await response.json();
      const leaves = (data && data.data) ? data.data : [];
      setLeaveHistory(leaves);

      // Block all dates in approved or pending leaves
      let blocked = [];
      leaves.forEach(lv => {
        if (["APPROVED", "PENDING"].includes(lv.status)) {
          let d = new Date(lv.startDate);
          let end = new Date(lv.endDate);
          while (d <= end) {
            blocked.push(d.toISOString().slice(0, 10));
            d.setDate(d.getDate() + 1);
          }
        }
      });
      setBlockedDates(blocked);
    } catch (err) {
      console.error("Error fetching leave history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchHolidays = async () => {
    try {
      const year = new Date().getFullYear();
      const response = await api(`/api/holidays/year/${year}`);
      const data = await response.json();
      if (data && data.status === "success") {
        setHolidays(data.data || []);
      }
    } catch (err) {
      console.error("Error fetching holidays:", err);
    }
  };

  const fetchCompanyDetails = async () => {
    if (!employeeId) return;
    try {
      const response = await api(`/api/company-details/employee/${employeeId}`);
      if (response.ok) {
        const result = await response.json();
        if (result.data && result.data.joiningDate) {
          setJoiningDate(result.data.joiningDate);
        }
      }
    } catch (err) {
      console.error("Error fetching company details:", err);
    }
  };

  const fetchTimesheets = async () => {
    if (!employeeId) return;
    try {
      const response = await api(`/api/timesheets?employeeId=${employeeId}`);
      if (response.ok) {
        const result = await response.json();
        setTimesheets(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching timesheets:", err);
    }
  };

  useEffect(() => {
    fetchLeaveHistory();
    fetchHolidays();
    fetchCompanyDetails();
    fetchTimesheets();
  }, [employeeId]);

  const parseDateLocal = (d) => {
    if (!d) return new Date();
    if (d instanceof Date) return new Date(d);
    const s = d.toString().split('T')[0];
    const parts = s.split('-');
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(d);
  };

  const getLocalDateStr = (date) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getMinAllowedDate = () => {
    const today = new Date();
    const past30 = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    if (joiningDate) {
      const jDate = parseDateLocal(joiningDate);
      const targetDate = jDate > past30 ? jDate : past30;
      return getLocalDateStr(targetDate);
    }
    
    return getLocalDateStr(past30);
  };

  const hasSubmittedOrApprovedTimesheet = () => {
    if (!formData.startDate || !formData.endDate || timesheets.length === 0) return false;

    // Helper to get week start date for a given date string (Saturday to Friday week)
    const getWeekStartDate = (dateStr) => {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return null;
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      
      const dayOfWeek = d.getDay(); // 0 is Sunday, 6 is Saturday
      const diff = (dayOfWeek + 1) % 7; // diff from Saturday
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      
      // format as YYYY-MM-DD
      const y = d.getFullYear();
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const da = d.getDate().toString().padStart(2, '0');
      return `${y}-${m}-${da}`;
    };

    // Calculate all unique week starts covered by the leave dates
    const leaveWeeks = new Set();
    let curr = new Date(formData.startDate);
    const endVal = new Date(formData.endDate);
    while (curr <= endVal) {
      const iso = curr.toISOString().slice(0, 10);
      const weekStart = getWeekStartDate(iso);
      if (weekStart) leaveWeeks.add(weekStart);
      curr.setDate(curr.getDate() + 1);
    }

    // Now, group timesheet entries by their week start
    const weeksMap = {};
    timesheets.forEach(entry => {
      if (!entry.date) return;
      const iso = entry.date.split('T')[0];
      const weekStart = getWeekStartDate(iso);
      if (!weekStart) return;

      if (!weeksMap[weekStart]) {
        weeksMap[weekStart] = { entries: [] };
      }
      weeksMap[weekStart].entries.push(entry);
    });

    // Check if any leave week has submitted or approved timesheet entries
    for (let ws of leaveWeeks) {
      const week = weeksMap[ws];
      if (week && week.entries.length > 0) {
        // If any entry in this week is PENDING or APPROVED
        const hasSubmittedOrApproved = week.entries.some(entry => 
          entry.status === 'PENDING' || entry.status === 'APPROVED'
        );
        if (hasSubmittedOrApproved) return true;
      }
    }

    return false;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'startDate' || name === 'endDate') {
      setDateError(false);
    }

    setFormData((prev) => {
      const newState = { ...prev, [name]: value };

      // If dates changed, sync the breakdown
      if (name === 'startDate' || name === 'endDate') {
        if (newState.startDate && newState.endDate) {
          let d = parseDateLocal(newState.startDate);
          const endDateObj = parseDateLocal(newState.endDate);
          const holidayDates = holidays.map(h => h.holidayDate);
          let rangeInvalid = false;

          while (d <= endDateObj) {
            const iso = getLocalDateStr(d);
            const isHoliday = holidayDates.includes(iso);
            const isBlocked = blockedDates.includes(iso);
            
            if (isHoliday) {
              const formattedDate = d.toLocaleDateString('en-GB');
              toast.error(`Date ${formattedDate} is a holiday.`);
              rangeInvalid = true;
              break;
            }
            if (isBlocked) {
              const formattedDate = d.toLocaleDateString('en-GB');
              toast.error(`Leave request is already pending/approved for ${formattedDate}.`);
              rangeInvalid = true;
              break;
            }
            d.setDate(d.getDate() + 1);
          }

          if (rangeInvalid) {
            setDateError(true);
            newState.sessionData = {};
            newState.daysCount = 0;
            return newState;
          }

          const sessions = { ...prev.sessionData };
          const range = getDatesInRange(newState.startDate, newState.endDate);

          const newSessionData = {};
          range.forEach(date => {
            newSessionData[date] = sessions[date] || "FULL";
          });
          newState.sessionData = newSessionData;
          newState.daysCount = calculateTotalFromSessions(newSessionData);
        }
      }
      return newState;
    });
  };

  const handleSessionChange = (date, session) => {
    setFormData(prev => {
      const newSessionData = { ...prev.sessionData, [date]: session };
      return {
        ...prev,
        sessionData: newSessionData,
        daysCount: calculateTotalFromSessions(newSessionData)
      };
    });
  };

  const getDatesInRange = (start, end) => {
    const dates = [];
    let d = new Date(start);
    const endDate = new Date(end);
    const holidayDates = holidays.map(h => h.holidayDate);

    while (d <= endDate) {
      const day = d.getDay();
      const iso = d.toISOString().slice(0, 10);
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidayDates.includes(iso);

      if (!isWeekend && !isHoliday) {
        dates.push(iso);
      }
      d.setDate(d.getDate() + 1);
    }
    return dates;
  };

  const calculateTotalFromSessions = (sessions) => {
    return Object.values(sessions).reduce((acc, val) => {
      return acc + (val === "FULL" ? 1.0 : 0.5);
    }, 0);
  };

  // Calculate leave days, skipping weekends and blocked days
  const calculateLeaveDays = (start, end, ignoreBlockedDates = false) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

    let total = 0;
    let d = new Date(startDate);
    const holidayDates = holidays.map(h => h.holidayDate);

    while (d <= endDate) {
      const day = d.getDay();
      const iso = d.toISOString().slice(0, 10);
      const isWeekend = day === 0 || day === 6;
      const isHoliday = holidayDates.includes(iso);
      const isBlocked = !ignoreBlockedDates && blockedDates.includes(iso);

      if (!isWeekend && !isHoliday && !isBlocked) {
        total += 1.0;
      }
      d.setDate(d.getDate() + 1);
    }
    return total;
  };

  const getDateBreakdown = () => {
    if (!formData.startDate || !formData.endDate) return [];

    const results = [];
    let d = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const holidayDates = holidays.map(h => h.holidayDate);

    while (d <= end) {
      const iso = d.toISOString().slice(0, 10);
      const dayOfWeek = d.getDay();
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const monthDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase();

      const holiday = holidays.find(h => h.holidayDate === iso);
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      let label = "";
      let type = "work";

      if (holiday) {
        label = `${holiday.holidayName} holiday`;
        type = "holiday";
      } else if (isWeekend) {
        label = `${dayName}(weekend)`;
        type = "weekend";
      } else {
        const session = formData.sessionData[iso] || "FULL";
        const suffix = session !== "FULL" ? ` (${session.toLowerCase()})` : '';
        label = `${formData.leaveType.toLowerCase()} leave${suffix}`;
        type = "leave";
      }

      results.push({ date: monthDay, label, type });
      d = new Date(d.setDate(d.getDate() + 1));
    }
    return results;
  };

  const handleRequest = async (e) => {
    if (e) e.preventDefault();

    if (!formData.leaveType || !formData.startDate || !formData.endDate || !formData.reason) {
      toast.error('Please fill in all fields');
      return;
    }

    if (formData.reason && formData.reason.length > 255) {
      toast.error('Reason for leave cannot exceed 255 characters');
      return;
    }

    if (!employeeId) {
      toast.error('Employee ID not found. Please login again.');
      return;
    }

    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      toast.error('Start date cannot be after end date');
      return;
    }

    const minAllowed = getMinAllowedDate();
    if (formData.startDate < minAllowed) {
      toast.error(`Start date cannot be before ${minAllowed}`);
      return;
    }

    if (dateError) {
      toast.error('Please select valid dates.');
      return;
    }

    let dVal = parseDateLocal(formData.startDate);
    const endObjVal = parseDateLocal(formData.endDate);
    const holidayDates = holidays.map(h => h.holidayDate);
    while (dVal <= endObjVal) {
      const iso = getLocalDateStr(dVal);
      if (holidayDates.includes(iso)) {
        toast.error(`Date ${dVal.toLocaleDateString('en-GB')} is a holiday.`);
        setDateError(true);
        return;
      }
      if (blockedDates.includes(iso)) {
        toast.error(`Leave request is already pending/approved for ${dVal.toLocaleDateString('en-GB')}.`);
        setDateError(true);
        return;
      }
      dVal.setDate(dVal.getDate() + 1);
    }

    if (hasSubmittedOrApprovedTimesheet()) {
      const proceed = window.confirm("Your timesheet(s) will need to be resubmitted once your leave gets approved. Do you want to proceed?");
      if (!proceed) return;
    }

    // Calculate days requested
    const daysRequested = calculateLeaveDays(formData.startDate, formData.endDate);

    // Check balance
    if (!leaveBalance) {
      toast.error('Unable to check leave balance');
      return;
    }

    const leaveTypeKey = formData.leaveType.toLowerCase();

    // Skip balance check for LOP
    if (formData.leaveType !== 'LOP') {
      const availableKey = `${leaveTypeKey}LeavesRemaining`;
      const availableLeaves = leaveBalance[availableKey] || 0;

      if (availableLeaves < formData.daysCount) {
        toast.error(`Insufficient ${formData.leaveType} leaves. Available: ${availableLeaves.toFixed(2)}, Requested: ${formData.daysCount}. If more leaves required please take approval from HR and apply for LOP`);
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        employeeId: parseInt(employeeId),
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        daysCount: formData.daysCount,
        sessionData: formData.sessionData
      };

      const response = await api('/api/leaves', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Leave request submitted successfully!');
        setFormData({
          leaveType: '',
          startDate: '',
          endDate: '',
          reason: '',
          daysCount: 0,
          sessionData: {},
        });
        setIsPopupOpen(false);
        fetchLeaveHistory(); // Refresh history
        if (onLeaveRequestSuccess) {
          onLeaveRequestSuccess();
        }
      } else {
        toast.error(data.message || 'Failed to submit leave request');
      }
    } catch (err) {
      toast.error('Error submitting leave request: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'PENDING':
        return 'bg-brand-yellow/10 text-brand-yellow border-brand-yellow/20';
      case 'REJECTED':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-gray-400/10 text-gray-500 border-gray-400/20';
    }
  };

  const filteredHistory = leaveHistory.filter(
    (lv) => statusFilter === 'ALL' || (lv.status || '').toUpperCase() === statusFilter
  );

  return (
    <div className="space-y-8 font-brand">
      {/* Header with Title and New Request Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl font-black text-brand-blue uppercase tracking-widest">Leave History</h2>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue/40">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-bg-slate border border-brand-blue/10 rounded-xl text-[11px] font-bold text-brand-blue outline-none focus:border-brand-blue/30 transition-all cursor-pointer"
            >
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <button
            onClick={() => setIsPopupOpen(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-brand-blue text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-blue-hover transition-all shadow-md active:scale-95 text-xs"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Leave History Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-blue/5 card-hover">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0 text-sm">
            <thead className="bg-brand-blue">
              <tr className="text-white/40 font-bold uppercase tracking-widest text-[10px]">
                <th className="p-4 px-6 border-b border-white/5">Request Date</th>
                <th className="p-4 px-6 border-b border-white/5">Leave Type</th>
                <th className="p-4 px-6 border-b border-white/5">Start Date</th>
                <th className="p-4 px-6 border-b border-white/5">End Date</th>
                <th className="p-4 px-6 border-b border-white/5 text-center">Days</th>
                <th className="p-4 px-6 border-b border-white/5 text-center">Status</th>
                <th className="p-4 px-6 border-b border-white/5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-blue/5">
              {historyLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-brand-blue/30 font-bold uppercase tracking-widest text-xs animate-pulse">
                    Loading leave history...
                  </td>
                </tr>
              ) : filteredHistory.length > 0 ? (
                filteredHistory.map((leave) => {
                  const daysNum = leave.daysCount || 0;
                  return (
                    <tr key={leave.id} className="hover:bg-bg-slate transition-colors">
                      <td className="p-4 px-6 font-bold text-brand-blue">{formatDate(leave.submittedAt || leave.createdAt || leave.startDate)}</td>
                      <td className="p-4 px-6 font-bold text-brand-blue uppercase text-xs">{leave.leaveType}</td>
                      <td className="p-4 px-6 text-brand-blue/70">{formatDate(leave.startDate)}</td>
                      <td className="p-4 px-6 text-brand-blue/70">{formatDate(leave.endDate)}</td>
                      <td className="p-4 px-6 text-center font-black text-brand-blue">{daysNum}</td>
                      <td className="p-4 px-6 text-center">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${getStatusColor(leave.status)}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="p-4 px-6 text-right">
                        <button
                          onClick={() => {
                            setSelectedLeave(leave);
                            setIsDetailsModalOpen(true);
                          }}
                          className="p-2 bg-brand-blue/5 text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-all shadow-sm"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-12 text-center text-brand-blue/20">
                    <p className="font-bold uppercase tracking-widest text-[10px] italic">No leave history found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Request Modal */}
      {isPopupOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
          <div className="absolute inset-0 bg-brand-blue/80 backdrop-blur-md" onClick={() => setIsPopupOpen(false)}></div>

          <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] border border-brand-blue/10 animate-in fade-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="bg-brand-blue px-6 py-6 flex justify-between items-center rounded-t-[2rem] flex-shrink-0">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-wider">New Leave Request</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Submit your leave application</p>
              </div>
              <button
                onClick={() => setIsPopupOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-brand-yellow hover:text-brand-blue transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 md:p-10 min-h-0 custom-scrollbar">
              <form id="leaveForm" onSubmit={handleRequest} className="space-y-6">
                {/* Balance Info */}
                <div className="mb-8">
                  <div className="p-4 bg-brand-yellow/10 border border-brand-yellow/20 rounded-2xl">
                    <div className="grid grid-cols-3 gap-4 text-[10px] font-black uppercase tracking-widest text-brand-blue text-center">
                      <div>
                        <span className="opacity-40 block mb-1">Casual</span>
                        <span className="text-lg">{(leaveBalance.casualLeavesRemaining ?? 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="opacity-40 block mb-1 text-red-500/50">Sick</span>
                        <span className="text-lg text-red-500">{(leaveBalance.sickLeavesRemaining ?? 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="opacity-40 block mb-1 text-emerald-500/50">Earned</span>
                        <span className="text-lg text-emerald-500">{(leaveBalance.earnedLeavesRemaining ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  {((leaveBalance.casualLeavesRemaining ?? 0) + (leaveBalance.sickLeavesRemaining ?? 0) + (leaveBalance.earnedLeavesRemaining ?? 0)) === 0 && (
                    <p className="mt-3 text-[10px] font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 italic">
                      Note: you don't have any available paid leaves, please take approval from HR and apply for LOP
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {/* Leave Type */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest block ml-1">Leave Type</label>
                    <select
                      name="leaveType"
                      value={formData.leaveType}
                      onChange={handleInputChange}
                      className="w-full px-5 py-4 bg-bg-slate border-2 border-transparent focus:border-brand-yellow rounded-2xl text-sm font-bold text-brand-blue outline-none transition-all shadow-sm appearance-none"
                    >
                      <option value="">Select Type</option>
                      <option value="SICK">Sick Leave</option>
                      <option value="CASUAL">Casual Leave</option>
                      <option value="EARNED">Earned Leave</option>
                      <option value="LOP">Loss of Pay (LOP)</option>
                    </select>
                    {formData.leaveType === 'LOP' && (
                      <p className="text-[10px] text-red-500 font-bold mt-2 animate-pulse">
                        ⚠ your salary will be deducted for this leave request
                      </p>
                    )}
                  </div>

                  {/* Days Display (read-only placeholder) */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest block ml-1">Total Duration</label>
                    <div className="w-full px-5 py-4 bg-bg-slate border-2 border-transparent rounded-2xl text-sm font-bold text-brand-blue shadow-sm">
                      {formData.daysCount} Days
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest block ml-1">Start Date</label>
                    <DateInput
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      min={getMinAllowedDate()}
                      onBlur={e => {
                        const iso = e.target.value;
                        const minDateVal = getMinAllowedDate();
                        if (iso && iso < minDateVal) {
                          toast.error(`Start date cannot be before ${minDateVal}`);
                          setDateError(true);
                          return;
                        }
                        const d = parseDateLocal(iso);
                        const isHoliday = holidays.some(h => h.holidayDate === iso);
                        if (iso && (d.getDay() === 0 || d.getDay() === 6 || blockedDates.includes(iso) || isHoliday)) {
                          toast.error(isHoliday ? 'Start date cannot be a holiday.' : 'Start date cannot be a weekend or already requested/approved leave.');
                          setDateError(true);
                        }
                      }}
                      className={`w-full px-5 py-4 bg-bg-slate border-2 rounded-2xl text-sm font-bold text-brand-blue outline-none transition-all shadow-sm ${dateError ? 'border-red-500 bg-red-50/50' : 'border-transparent focus:border-brand-yellow'}`}
                    />
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest block ml-1">End Date</label>
                    <DateInput
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      min={formData.startDate || getMinAllowedDate()}
                      onBlur={e => {
                        const iso = e.target.value;
                        const minDateVal = getMinAllowedDate();
                        if (iso && iso < minDateVal) {
                          toast.error(`End date cannot be before ${minDateVal}`);
                          setDateError(true);
                          return;
                        }
                        const d = parseDateLocal(iso);
                        const isHoliday = holidays.some(h => h.holidayDate === iso);
                        if (iso && (d.getDay() === 0 || d.getDay() === 6 || blockedDates.includes(iso) || isHoliday)) {
                          toast.error(isHoliday ? 'End date cannot be a holiday.' : 'End date cannot be a weekend or already requested/approved leave.');
                          setDateError(true);
                        }
                      }}
                      className={`w-full px-5 py-4 bg-bg-slate border-2 rounded-2xl text-sm font-bold text-brand-blue outline-none transition-all shadow-sm ${dateError ? 'border-red-500 bg-red-50/50' : 'border-transparent focus:border-brand-yellow'}`}
                    />
                  </div>
                </div>

                {hasSubmittedOrApprovedTimesheet() && (
                  <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl text-[10px] font-black text-amber-700 uppercase tracking-wider animate-pulse">
                    ⚠ Note: Your timesheet(s) will need to be resubmitted once your leave gets approved.
                  </div>
                )}

                {/* Daily Breakdown Section */}
                {formData.startDate && formData.endDate && Object.keys(formData.sessionData).length > 0 && (
                  <div className="bg-bg-slate/30 border border-brand-blue/10 rounded-2xl overflow-hidden shadow-inner flex flex-col">
                    <div className="bg-white/80 px-4 py-2.5 border-b border-brand-blue/10 flex items-center justify-between flex-shrink-0">
                      <h4 className="text-[10px] font-black text-brand-blue/70 uppercase tracking-widest">Daily Breakdown</h4>
                      <span className="text-[9px] font-bold text-brand-blue/50 uppercase tracking-wider">{Object.keys(formData.sessionData).length} Days Listed</span>
                    </div>
                    <div className="divide-y divide-brand-blue/5 max-h-[260px] overflow-y-auto custom-scrollbar pr-1.5">
                      {Object.keys(formData.sessionData).map((date) => {
                        const dateObj = new Date(date);
                        const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        const currentSession = formData.sessionData[date];

                        return (
                          <div key={date} className="p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:bg-white/60 transition-colors gap-3">
                            <span className="text-[11px] font-bold text-brand-blue/80">{formattedDate}:</span>
                            <div className="flex items-center gap-1.5 w-full sm:w-auto justify-start sm:justify-end overflow-x-auto pb-1 sm:pb-0">
                              {/* Full Day */}
                              <label className={`flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-md transition-all ${currentSession === 'FULL' ? 'bg-brand-blue text-white shadow-sm' : 'hover:bg-brand-blue/10 text-brand-blue/60'}`}>
                                <input
                                  type="radio"
                                  name={`session-${date}`}
                                  value="FULL"
                                  checked={currentSession === 'FULL'}
                                  onChange={() => handleSessionChange(date, 'FULL')}
                                  className="sr-only"
                                />
                                <span className="text-[9px] font-black uppercase">Full Day</span>
                              </label>

                              {/* Morning */}
                              <label className={`flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-md transition-all ${currentSession === 'MORNING' ? 'bg-amber-500 text-white shadow-sm' : 'hover:bg-amber-500/10 text-brand-blue/60'}`}>
                                <input
                                  type="radio"
                                  name={`session-${date}`}
                                  value="MORNING"
                                  checked={currentSession === 'MORNING'}
                                  onChange={() => handleSessionChange(date, 'MORNING')}
                                  className="sr-only"
                                />
                                <span className="text-[9px] font-black uppercase">Morning</span>
                              </label>

                              {/* Afternoon */}
                              <label className={`flex items-center gap-1 cursor-pointer px-2.5 py-1 rounded-md transition-all ${currentSession === 'AFTERNOON' ? 'bg-indigo-500 text-white shadow-sm' : 'hover:bg-indigo-500/10 text-brand-blue/60'}`}>
                                <input
                                  type="radio"
                                  name={`session-${date}`}
                                  value="AFTERNOON"
                                  checked={currentSession === 'AFTERNOON'}
                                  onChange={() => handleSessionChange(date, 'AFTERNOON')}
                                  className="sr-only"
                                />
                                <span className="text-[9px] font-black uppercase">Afternoon</span>
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="bg-brand-blue/5 p-3 flex justify-between items-center border-t border-brand-blue/10 flex-shrink-0">
                      <span className="text-[10px] font-black text-brand-blue uppercase tracking-wider">Total Duration</span>
                      <span className="text-xs font-black text-brand-blue">{formData.daysCount} Days</span>
                    </div>
                  </div>
                )}



                {/* Reason */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest block">Reason for Leave</label>
                    <span className="text-[9px] font-bold text-brand-blue/30 uppercase tracking-wider">
                      {formData.reason.length} / 255 chars
                    </span>
                  </div>
                  <textarea
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    maxLength={255}
                    rows={4}
                    className="w-full px-5 py-4 bg-bg-slate border-2 border-transparent focus:border-brand-yellow rounded-2xl text-sm font-bold text-brand-blue placeholder:text-brand-blue/20 outline-none transition-all shadow-sm resize-none"
                    placeholder="e.g. Family emergency, personal work..."
                  />
                </div>
              </form>
            </div>

            {/* Modal Footer */}
            <div className="bg-white p-6 md:px-10 border-t border-brand-blue/5 rounded-b-[2rem] flex-shrink-0">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsPopupOpen(false)}
                  className="px-6 py-4 bg-bg-slate border border-brand-blue/5 text-brand-blue/40 font-black rounded-2xl hover:bg-brand-blue hover:text-white transition-all uppercase tracking-widest text-[11px] shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="leaveForm"
                  disabled={loading}
                  className="bg-brand-yellow text-brand-blue font-black py-4 px-6 rounded-2xl hover:shadow-xl hover:shadow-brand-yellow/30 transition-all active:scale-95 uppercase tracking-widest text-[11px] disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LeaveDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        leave={selectedLeave}
      />
    </div>
  );
};

export default LeaveRequestPage;

