import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";

import { toast } from "react-toastify";
import TimesheetSummary from "./timesheet/TimesheetSummary";
import WeeklyTimesheetGrid from "./timesheet/WeeklyTimesheetGrid";

const PersonalTimesheetContent = ({ employeeId, user, profileResolved = true, initialWeekKey = null, onClearInitialWeekKey = null, onBackToDashboard = null }) => {
    const [view, setView] = useState("summary"); // 'summary' or 'grid'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [timesheetData, setTimesheetData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [joiningDate, setJoiningDate] = useState(null);
    const [redirectedFromDashboard, setRedirectedFromDashboard] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [localInitialWeekKey, setLocalInitialWeekKey] = useState(initialWeekKey);

    useEffect(() => {
        setLocalInitialWeekKey(initialWeekKey);
    }, [initialWeekKey]);

    const [approvedLeaves, setApprovedLeaves] = useState([]);
    const [pendingLeaves, setPendingLeaves] = useState([]);
    const [holidays, setHolidays] = useState([]);

    useEffect(() => {
        if (employeeId) {
            fetchTimesheets(employeeId);
            fetchEmployeeDetails(employeeId);
            fetchApprovedLeaves(employeeId);
            fetchHolidays();
        }
    }, [employeeId]);

    const weeks = useMemo(() => {
        const computed = groupIntoWeeks(timesheetData, joiningDate);
        console.log("[PersonalTimesheetContent] computed weeks:", computed);
        return computed;
    }, [timesheetData, joiningDate]);

    function toLocalDateStr(date) {
        if (!date) return "";
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
            return date.split('T')[0];
        }
        const d = date instanceof Date ? date : new Date(date);
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    useEffect(() => {
        console.log("[PersonalTimesheetContent] checking selection. weeks length:", weeks.length, "localInitialWeekKey:", localInitialWeekKey, "hasFetched:", hasFetched);
        if (weeks.length > 0 && localInitialWeekKey && hasFetched) {
            const foundWeek = weeks.find(w => toLocalDateStr(w.start) === localInitialWeekKey);
            console.log("[PersonalTimesheetContent] foundWeek for key", localInitialWeekKey, ":", foundWeek);
            if (foundWeek) {
                setSelectedWeek(foundWeek);
                setView("grid");
                setRedirectedFromDashboard(true);
            }
            setLocalInitialWeekKey(null);
            if (onClearInitialWeekKey) {
                onClearInitialWeekKey();
            }
        }
    }, [weeks, localInitialWeekKey, hasFetched]);

    const fetchApprovedLeaves = async (id) => {
        try {
            const response = await api(`/api/leaves/employee/${id}`);
            const result = await response.json();
            if (response.ok && result.data) {
                // Filter approved and pending leaves
                const approved = result.data.filter(l => l.status === 'APPROVED');
                const pending = result.data.filter(l => l.status === 'PENDING');
                setApprovedLeaves(approved);
                setPendingLeaves(pending);
            }
        } catch (err) {
            console.error("Error fetching leaves", err);
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

    const fetchTimesheets = async (id) => {
        if (!id) return;
        try {
            setLoading(true);
            // includeDrafts=true: this is the employee's own editing view, so it must surface
            // their DRAFT (saved-but-not-submitted) weeks. Aggregate/manager views never pass this.
            const response = await api(`/api/timesheets?employeeId=${id}&includeDrafts=true`);
            const result = await response.json();
            if (response.ok) {
                console.log("[PersonalTimesheetContent] fetchTimesheets response for id", id, result.data);
                setTimesheetData(result.data || []);
            } else {
                toast.error(result.message || "Failed to fetch timesheets");
            }
        } catch (err) {
            toast.error("Error connecting to server");
            console.error(err);
        } finally {
            setLoading(false);
            setHasFetched(true);
        }
    };

    const fetchEmployeeDetails = async (id) => {
        try {
            const response = await api(`/api/employees/${id}`);
            const result = await response.json();
            if (response.ok && result.data) {
                setJoiningDate(result.data.joiningDate || result.data.hireDate);
            }
        } catch (err) {
            console.error("Error fetching employee details", err);
        }
    };

    function formatDate(date) {
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
    }

    function groupIntoWeeks(data, joiningDate) {
        const weeksMap = {};

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

        // Helper to get Saturday of the week
        const getSaturday = (d) => {
            const date = parseDateLocal(d);
            const day = date.getDay(); // 0 (Sun) to 6 (Sat)
            const diff = (day + 1) % 7;
            date.setDate(date.getDate() - diff);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        // Initialize weeks from now back to joiningDate
        const now = new Date();
        const startPoint = joiningDate ? parseDateLocal(joiningDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);

        let currentSat = getSaturday(now);
        const limitSat = getSaturday(startPoint);

        const getLocalDateStr = (date) => {
            if (!date) return "";
            if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
                return date.split('T')[0];
            }
            const d = date instanceof Date ? date : new Date(date);
            const year = d.getFullYear();
            const month = (d.getMonth() + 1).toString().padStart(2, '0');
            const day = d.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

        while (currentSat >= limitSat) {
            const key = getLocalDateStr(currentSat);
            const fri = new Date(currentSat);
            fri.setDate(currentSat.getDate() + 6);

            weeksMap[key] = {
                start: new Date(currentSat),
                end: fri,
                startDate: formatDate(currentSat),
                endDate: formatDate(fri),
                status: 'Not Filled',
                billableHrs: 0,
                nonBillableHrs: 0,
                timeOffHrs: 0,
                truTimeHrs: 0,
                entries: []
            };

            currentSat.setDate(currentSat.getDate() - 7);
        }

        data.forEach(entry => {
            const sat = getSaturday(entry.date);
            const key = getLocalDateStr(sat);

            if (!weeksMap[key]) {
                const fri = new Date(sat);
                fri.setDate(sat.getDate() + 6);
                weeksMap[key] = {
                    start: sat,
                    end: fri,
                    startDate: formatDate(sat),
                    endDate: formatDate(fri),
                    status: 'Approved',
                    billableHrs: 0,
                    nonBillableHrs: 0,
                    timeOffHrs: 0,
                    truTimeHrs: 0,
                    entries: []
                };
            }

            const week = weeksMap[key];
            week.entries.push(entry);

            if (entry.category === 'TRUTIME') {
                week.truTimeHrs += entry.totalHours;
            } else if (entry.category === 'HOLIDAY' || entry.category === 'TIMEOFF' || entry.category === 'LEAVE') {
                week.timeOffHrs += entry.totalHours;
            } else if (entry.billable) {
                week.billableHrs += entry.totalHours;
            } else {
                week.nonBillableHrs += entry.totalHours;
            }

            // Status precedence for the week: an in-approval-flow status (Pending/Approved/Rejected)
            // always wins over a Draft, so a week is only shown as "Draft" when every entry is a draft.
            if (entry.status === 'PENDING') {
                week.status = entry.reapplyUsed ? 'Reapproval Pending' : 'Pending';
            } else if (entry.status === 'REAPPLY_REQUESTED') {
                week.status = 'Reapply Requested';
            } else if (entry.status === 'REJECTED') {
                week.status = 'Rejected';
            } else if (entry.status === 'APPROVED') {
                week.status = 'Approved';
            } else if (entry.status === 'DRAFT' && week.status === 'Not Filled') {
                week.status = 'Draft';
            }
        });

        return Object.values(weeksMap).sort((a, b) => b.start - a.start);
    };

    const handleSelectWeek = (week) => {
        setSelectedWeek(week);
        setView("grid");
    };

    const handleSaveWeekly = async (payload) => {
        try {
            setLoading(true);
            const token = localStorage.getItem("token");

            // Format entries to include startTime/endTime
            const formattedEntries = payload.entries.map(entry => {
                const startTime = "09:00:00";
                const totalHrs = entry.totalHours || 0;
                const endHour = Math.floor(totalHrs + 9);
                const endMin = Math.round((totalHrs % 1) * 60);
                const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;
                return { ...entry, employeeId, startTime, endTime };
            });

            const weeklyPayload = { weekStart: payload.weekStart, entries: formattedEntries };
            console.log('[Timesheet] Saving payload:', JSON.stringify(weeklyPayload, null, 2));

            const response = await api("/api/timesheets/save-weekly", {
                method: 'POST',
                body: JSON.stringify(weeklyPayload)
            });

            const result = await response.json().catch(() => null);
            console.log('[Timesheet] Save response:', response.status, result);

            if (!response.ok) {
                const errMsg = result?.message || `Server error ${response.status}`;
                toast.error(`Failed to save: ${errMsg}`);
                return;
            }

            toast.success("Weekly timesheet saved successfully");
            setView("summary");
            fetchTimesheets(employeeId);
        } catch (err) {
            toast.error("Error saving timesheet");
            console.error('[Timesheet] Save error:', err);
        } finally {
            setLoading(false);
        }
    };

    // Rule 2: Save the week as a DRAFT (no approval flow triggered). Employee can return and
    // keep editing later. Uses the same payload shape as submit, just a different endpoint.
    const handleSaveDraft = async (payload) => {
        try {
            setLoading(true);

            const formattedEntries = payload.entries.map(entry => {
                const startTime = "09:00:00";
                const totalHrs = entry.totalHours || 0;
                const endHour = Math.floor(totalHrs + 9);
                const endMin = Math.round((totalHrs % 1) * 60);
                const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}:00`;
                return { ...entry, employeeId, startTime, endTime };
            });

            const draftPayload = { weekStart: payload.weekStart, entries: formattedEntries };

            const response = await api("/api/timesheets/save-draft", {
                method: 'POST',
                body: JSON.stringify(draftPayload)
            });

            const result = await response.json().catch(() => null);

            if (!response.ok) {
                const errMsg = result?.message || "Failed to save. Please try again.";
                toast.error(errMsg);
                return;
            }

            toast.success("Timesheet saved successfully");
            setView("summary");
            fetchTimesheets(employeeId);
        } catch (err) {
            toast.error("Failed to save. Please try again.");
            console.error('[Timesheet] Draft save error:', err);
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="w-full flex-1 flex flex-col min-h-0 px-4">


            {loading && (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Processing Request...</p>
                    </div>
                </div>
            )}

            {!loading && view === 'summary' && (
                <TimesheetSummary
                    weeks={weeks}
                    onSelectWeek={handleSelectWeek}
                />
            )}

            {!loading && view === 'grid' && (
                <WeeklyTimesheetGrid
                    weekData={selectedWeek}
                    employeeId={employeeId}
                    approvedLeaves={approvedLeaves}
                    pendingLeaves={pendingLeaves}
                    holidays={holidays}
                    // Part 6 — UI state per status: PENDING and APPROVED weeks are read-only.
                    // DRAFT, REJECTED and unfilled weeks stay editable (Save + Submit available).
                    readOnly={selectedWeek.status === 'Approved' || selectedWeek.status === 'Pending' || selectedWeek.status === 'Reapproval Pending'}
                    onBack={() => {
                        if (redirectedFromDashboard && onBackToDashboard) {
                            setRedirectedFromDashboard(false);
                            onBackToDashboard();
                        } else {
                            setView('summary');
                        }
                    }}
                    onSave={handleSaveWeekly}
                    onSaveDraft={handleSaveDraft}
                />
            )}
        </div>
    );
};

export default PersonalTimesheetContent;
