import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';

const EMPTY_ARRAY = [];

const WeeklyTimesheetGrid = ({ weekData, onBack, onSave, onSaveDraft, employeeId, approvedLeaves = EMPTY_ARRAY, pendingLeaves = EMPTY_ARRAY, holidays = EMPTY_ARRAY, readOnly = false, onApprove, onReject, disabledAccount = false }) => {
    // Dates for the week (7 days)
    const [dates, setDates] = useState([]);

    // Project rows
    const [projectRows, setProjectRows] = useState([
        { id: Date.now(), projectId: '', projectName: '', taskId: '', taskDesc: '', onsite: 'Offshore', billable: 'Billable', location: 'India', hours: Array.from({ length: 7 }, () => ({ value: '', id: null })), comment: '' }
    ]);

    // TruTime rows (Swipe)
    const [truTimeRows, setTruTimeRows] = useState({
        swipe: Array(7).fill({ value: '', id: null }),
    });

    // Holiday / Time off / Leave
    const [leaveRows, setLeaveRows] = useState({
        holiday: Array(7).fill({ value: '', id: null }),
        leaveS: Array(7).fill({ value: '', id: null }),
        leaveC: Array(7).fill({ value: '', id: null }),
        leaveE: Array(7).fill({ value: '', id: null }),
        leaveL: Array(7).fill({ value: '', id: null })
    });

    const lastInitializedKey = useRef("");

    useEffect(() => {
        if (weekData && weekData.start) {
            const currentKey = `${employeeId}_${getLocalDateStr(weekData.start)}`;
            if (lastInitializedKey.current === currentKey) {
                // Already initialized for this employee + week, do not overwrite user edits!
                return;
            }
            lastInitializedKey.current = currentKey;

            const dateList = [];
            let current = parseDateLocal(weekData.start);
            for (let i = 0; i < 7; i++) {
                dateList.push(new Date(current));
                current.setDate(current.getDate() + 1);
            }
            setDates(dateList);

            // Initialize local data structures
            const projects = {};
            const swipes = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const holidayData = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesS = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesC = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesE = Array(7).fill(null).map(() => ({ value: '', id: null }));
            const leavesL = Array(7).fill(null).map(() => ({ value: '', id: null }));

            const weekDates = [];
            let d = parseDateLocal(weekData.start);
            for (let i = 0; i < 7; i++) {
                weekDates.push(getLocalDateStr(d));
                d.setDate(d.getDate() + 1);
            }

            // Populate existing data if available
            if (weekData.entries && weekData.entries.length > 0) {
                weekData.entries.forEach(entry => {
                    const entryDateStr = getLocalDateStr(entry.date);
                    const dayIdx = weekDates.indexOf(entryDateStr);

                    if (dayIdx !== -1) {
                        if (entry.category === 'PROJECT') {
                            const key = (entry.rowIndex !== null && entry.rowIndex !== undefined)
                                ? `row_idx_${entry.rowIndex}`
                                : [
                                    entry.project || '',
                                    entry.projectName || '',
                                    entry.task || '',
                                    entry.taskDescription || '',
                                    entry.onsiteOffshore || '',
                                    String(entry.billable),
                                    entry.billingLocation || '',
                                    entry.notes || ''
                                ].join('||');
                            if (!projects[key]) {
                                projects[key] = {
                                    id: Date.now() + Math.random(),
                                    projectId: entry.project || '',
                                    projectName: entry.projectName || '',
                                    taskId: entry.task || '',
                                    taskDesc: entry.taskDescription || '',
                                    onsite: entry.onsiteOffshore || 'Offshore',
                                    billable: entry.billable ? 'Billable' : 'Non-Billable',
                                    location: entry.billingLocation || 'India',
                                    hours: Array.from({ length: 7 }, () => ({ value: '', id: null })),
                                    comment: entry.notes || ''
                                };
                            }
                            projects[key].hours[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        } else if (entry.category === 'TRUTIME') {
                            swipes[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        } else if (entry.category === 'HOLIDAY') {
                            holidayData[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        } else if (entry.category === 'LEAVE') {
                            if (entry.leaveType === 'S') leavesS[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            else if (entry.leaveType === 'C') leavesC[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            else if (entry.leaveType === 'E') leavesE[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                            else if (entry.leaveType === 'L') leavesL[dayIdx] = { value: entry.totalHours.toString(), id: entry.id };
                        }
                    }
                });
            }

            // Auto-populate 4 or 8 hours for approved leaves
            weekDates.forEach((ds, dayIdx) => {
                const gridDate = parseDateLocal(ds);
                gridDate.setHours(0, 0, 0, 0);

                if (isWeekend(gridDate)) return; // Skip weekends

                approvedLeaves.forEach(leave => {
                    const start = parseDateLocal(leave.startDate);
                    const end = parseDateLocal(leave.endDate);
                    start.setHours(0, 0, 0, 0);
                    end.setHours(0, 0, 0, 0);

                    if (gridDate >= start && gridDate <= end) {
                        let hoursAuto = "8.00";
                        if (leave.sessionData && leave.sessionData[ds]) {
                            const session = leave.sessionData[ds];
                            if (session === 'MORNING' || session === 'AFTERNOON') {
                                hoursAuto = "4.00";
                            }
                        }

                        if (leave.leaveType === 'SICK' && !leavesS[dayIdx].value) {
                            leavesS[dayIdx] = { ...leavesS[dayIdx], value: hoursAuto };
                        } else if (leave.leaveType === 'CASUAL' && !leavesC[dayIdx].value) {
                            leavesC[dayIdx] = { ...leavesC[dayIdx], value: hoursAuto };
                        } else if (leave.leaveType === 'EARNED' && !leavesE[dayIdx].value) {
                            leavesE[dayIdx] = { ...leavesE[dayIdx], value: hoursAuto };
                        } else if (leave.leaveType === 'LOP' && !leavesL[dayIdx].value) {
                            leavesL[dayIdx] = { ...leavesL[dayIdx], value: hoursAuto };
                        }
                    }
                });
            });

            // Auto-populate 8 hours for holidays
            weekDates.forEach((ds, dayIdx) => {
                const gridDate = parseDateLocal(ds);
                if (isWeekend(gridDate)) return; // Skip weekends

                if (holidays.some(h => getLocalDateStr(h.holidayDate) === ds) && !holidayData[dayIdx].value) {
                    holidayData[dayIdx] = { ...holidayData[dayIdx], value: '8.00' };
                }
            });

            const projectRowsList = Object.values(projects);
            if (projectRowsList.length > 0) setProjectRows(projectRowsList);
            else setProjectRows([{ id: Date.now() + Math.random(), projectId: '', projectName: '', taskId: '', taskDesc: '', onsite: 'Offshore', billable: 'Billable', location: 'India', hours: Array.from({ length: 7 }, () => ({ value: '', id: null })), comment: '' }]);

            setTruTimeRows({ swipe: swipes });
            setLeaveRows({
                holiday: holidayData,
                leaveS: leavesS,
                leaveC: leavesC,
                leaveE: leavesE,
                leaveL: leavesL
            });
        }
    }, [weekData, approvedLeaves, holidays]);

    const handleAddRow = () => {
        setProjectRows([...projectRows, { id: Date.now() + Math.random(), projectId: '', projectName: '', taskId: '', taskDesc: '', onsite: 'Offshore', billable: 'Billable', location: 'India', hours: Array.from({ length: 7 }, () => ({ value: '', id: null })), comment: '' }]);
    };

    const handleRowChange = (rowIndex, field, value) => {
        const updated = projectRows.map((row, idx) =>
            idx === rowIndex ? { ...row, [field]: value } : row
        );
        setProjectRows(updated);
    };

    const getLocalDateStr = (date) => {
        if (!date) return "";
        const d = date instanceof Date ? date : new Date(date);
        // If it was a string YYYY-MM-DD, new Date(string) creates UTC.
        // But getFullYear/getMonth/getDate are local.
        // If user is in UTC+5:30, UTC 00:00 is 05:30 same day. Correct.
        // If user is in UTC-5:00, UTC 00:00 is 19:00 previous day. Incorrect!
        // So we strictly use string splitting for YYYY-MM-DD strings.
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
            return date.split('T')[0];
        }
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

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

    const isWeekend = (date) => {
        if (!date) return false;
        const day = date instanceof Date ? date.getDay() : new Date(date).getDay();
        return day === 0 || day === 6; // Sunday = 0, Saturday = 6
    };

    // Rule 1: a date is "future" if it falls after today. Future day columns are locked —
    // the employee can only enter hours for today and past days of the week.
    const isFutureDate = (date) => {
        if (!date) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const cellDate = date instanceof Date ? new Date(date) : parseDateLocal(date);
        cellDate.setHours(0, 0, 0, 0);
        return cellDate > today;
    };

    const isHolidayDay = (dayIdx) => {
        if (!dates[dayIdx]) return false;
        const ds = getLocalDateStr(dates[dayIdx]);
        return holidays.some(h => getLocalDateStr(h.holidayDate) === ds);
    };



    // Numeric-only sanitizer for timesheet hour fields:
    // keeps digits and a single decimal point (hours are fractional, e.g. 4.5);
    // strips letters, symbols, spaces, etc. Blocks invalid input while typing AND on paste.
    const sanitizeHours = (value) => {
        let v = String(value ?? '').replace(/[^0-9.]/g, '');
        const firstDot = v.indexOf('.');
        if (firstDot !== -1) {
            v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
        }
        return v;
    };

    const handleHourChange = (rowIndex, dayIndex, value) => {
        // Validation removed to allow "two entries in single column" (e.g. 4h Leave + 4h Work)
        const clean = sanitizeHours(value);
        const updated = projectRows.map((row, rIdx) => {
            if (rIdx !== rowIndex) return row;
            const newHours = row.hours.map((h, dIdx) =>
                dIdx === dayIndex ? { ...h, value: clean } : h
            );
            return { ...row, hours: newHours };
        });
        setProjectRows(updated);
    };

    const handleLeaveHourChange = (typeKey, dayIndex, value) => {
        const clean = sanitizeHours(value);
        const updated = { ...leaveRows, [typeKey]: [...leaveRows[typeKey]] };
        updated[typeKey][dayIndex] = { ...updated[typeKey][dayIndex], value: clean };
        setLeaveRows(updated);
    };

    const handleSwipeChange = (dayIndex, value) => {
        const clean = sanitizeHours(value);
        setTruTimeRows((prev) => ({
            ...prev,
            swipe: prev.swipe.map((sh, idx) => (idx === dayIndex ? { ...sh, value: clean } : sh)),
        }));
    };

    // Block invalid keystrokes (letters/symbols/space) before they register.
    const handleHoursKeyDown = (e) => {
        const allowed = ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Enter'];
        if (allowed.includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (e.key === '.') {
            if (e.currentTarget.value.includes('.')) e.preventDefault();
            return;
        }
        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
    };

    const calculateRowTotal = (hours) => {
        return hours.reduce((sum, h) => sum + (parseFloat(h.value) || 0), 0);
    };

    const getGrandTotal = () => {
        let total = 0;
        projectRows.forEach(row => total += calculateRowTotal(row.hours));
        leaveRows.holiday.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveS.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveC.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveE.forEach(h => total += (parseFloat(h.value) || 0));
        leaveRows.leaveL.forEach(h => total += (parseFloat(h.value) || 0));
        return total;
    };

    const getTruTimeTotal = () => {
        let total = 0;
        truTimeRows.swipe.forEach(h => total += (parseFloat(h.value) || 0));
        return total;
    };

    const pendingLeaveMessage = React.useMemo(() => {
        if (!pendingLeaves || pendingLeaves.length === 0 || dates.length === 0) return null;

        const pendingDays = [];
        dates.forEach(date => {
            const gridDate = new Date(date);
            gridDate.setHours(0, 0, 0, 0);

            pendingLeaves.forEach(leave => {
                const start = parseDateLocal(leave.startDate);
                const end = parseDateLocal(leave.endDate);
                start.setHours(0, 0, 0, 0);
                end.setHours(0, 0, 0, 0);

                if (gridDate >= start && gridDate <= end) {
                    const dateStr = getLocalDateStr(gridDate);
                    if (!pendingDays.includes(dateStr)) {
                        pendingDays.push(dateStr);
                    }
                }
            });
        });

        if (pendingDays.length > 0) {
            pendingDays.sort();
            const formatted = pendingDays.map(ds => {
                const dateObj = parseDateLocal(ds);
                const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                return `${dateObj.getDate().toString().padStart(2, '0')}-${months[dateObj.getMonth()]}-${dateObj.getFullYear()}`;
            });
            return `Your leave is pending for the days: ${formatted.join(', ')}`;
        }
        return null;
    }, [pendingLeaves, dates]);

    // Project ID / Name are mandatory on any project row that has hours entered.
    // Shared by both Save (draft) and Submit so the backend never rejects the payload.
    const validateProjectRows = () => {
        for (let idx = 0; idx < projectRows.length; idx++) {
            const row = projectRows[idx];
            const rowTotal = calculateRowTotal(row.hours);
            if (rowTotal > 0) {
                if (!row.projectId || !row.projectId.trim()) {
                    toast.error(`Project ID is required for project row ${idx + 1}.`);
                    return false;
                }
                if (!row.projectName || !row.projectName.trim()) {
                    toast.error(`Project Name is required for project row ${idx + 1}.`);
                    return false;
                }
            }
        }
        return true;
    };

    // Build the weekly payload from the current grid state. Future-dated cells are locked and
    // therefore never carry a value, but we guard explicitly so a future entry can never be sent.
    const buildPayload = () => {
        const payload = {
            employeeId,
            weekStart: getLocalDateStr(weekData.start),
            entries: []
        };

        const pushEntry = (i, entry) => {
            if (isFutureDate(dates[i])) return; // never submit/save future dates
            payload.entries.push(entry);
        };

        projectRows.forEach((row, rowIndex) => {
            row.hours.forEach((h, i) => {
                const val = parseFloat(h.value);
                if (val > 0) {
                    pushEntry(i, {
                        id: h.id,
                        date: getLocalDateStr(dates[i]),
                        project: row.projectId,
                        projectName: row.projectName,
                        task: row.taskId,
                        taskDescription: row.taskDesc,
                        onsiteOffshore: row.onsite,
                        billingLocation: row.location,
                        billable: row.billable === 'Billable',
                        totalHours: val,
                        category: 'PROJECT',
                        notes: row.comment,
                        rowIndex: rowIndex
                    });
                }
            });
        });

        truTimeRows.swipe.forEach((h, i) => {
            const val = parseFloat(h.value);
            if (val > 0) {
                pushEntry(i, {
                    id: h.id,
                    date: getLocalDateStr(dates[i]),
                    totalHours: val,
                    category: 'TRUTIME',
                    projectName: 'TruTime Swipe'
                });
            }
        });

        leaveRows.holiday.forEach((h, i) => {
            const val = parseFloat(h.value);
            if (val > 0) {
                pushEntry(i, {
                    id: h.id,
                    date: getLocalDateStr(dates[i]),
                    totalHours: val,
                    category: 'HOLIDAY',
                    projectName: 'Holiday'
                });
            }
        });

        const leaveTypes = ['S', 'C', 'E', 'L'];
        const fullNames = ['Sick', 'Casual', 'Earned', 'LOP'];
        ['leaveS', 'leaveC', 'leaveE', 'leaveL'].forEach((key, typeIdx) => {
            leaveRows[key].forEach((h, i) => {
                const val = parseFloat(h.value);
                if (val > 0) {
                    pushEntry(i, {
                        id: h.id,
                        date: getLocalDateStr(dates[i]),
                        totalHours: val,
                        category: 'LEAVE',
                        leaveType: leaveTypes[typeIdx],
                        projectName: `Leave (${fullNames[typeIdx]})`
                    });
                }
            });
        });

        return payload;
    };

    // Rule 2: Save the week as a DRAFT. Unlike Submit, a draft is allowed to be partial —
    // we do NOT require each weekday to total 8 hours, only that project rows are identified.
    const handleDraftSave = () => {
        if (!validateProjectRows()) return;
        onSaveDraft(buildPayload());
    };

    const handleSave = () => {
        // Validate project rows
        if (!validateProjectRows()) return;

        // Validate daily hours
        for (let i = 0; i < 7; i++) {
            if (isWeekend(dates[i])) continue;
            // Future days are locked (Rule 1) and can't be filled yet, so they are not required
            // to reach 8h at submit time — only today and past weekdays are validated.
            if (isFutureDate(dates[i])) continue;
            let dailyTotal = 0;
            projectRows.forEach(row => dailyTotal += (parseFloat(row.hours[i].value) || 0));
            dailyTotal += (parseFloat(leaveRows.holiday[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveS[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveC[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveE[i].value) || 0);
            dailyTotal += (parseFloat(leaveRows.leaveL[i].value) || 0);
            const roundedTotal = parseFloat(dailyTotal.toFixed(2));
            if (roundedTotal === 0) {
                toast.error(`Hours for ${dates[i].toDateString()} are not filled.`);
                return;
            } else if (roundedTotal !== 8.00) {
                toast.error(`Total hours for ${dates[i].toDateString()} should be 8 hours (currently ${dailyTotal.toFixed(2)} hours).`);
                return;
            }
        }

        onSave(buildPayload());
    };

    const formatDateHeader = (date) => {
        if (!date || !(date instanceof Date)) return { day: '', name: '' };
        const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        return {
            day: date.getDate(),
            name: days[date.getDay()] || ''
        };
    };

    return (
        <div className="flex flex-col max-w-full mx-auto w-full flex-1 min-h-0">
            {/* Back navigation — standalone, ABOVE/OUTSIDE the timesheet card */}
            <button
                onClick={onBack}
                aria-label="Back"
                className="self-start mb-3 inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold text-sm transition-colors group"
            >
                <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back</span>
            </button>

            {/* Disabled-account banner — shown to Admin/HR/RM viewing a disabled employee's timesheet.
                Records are read-only; no approve/reject actions are available. */}
            {disabledAccount && (
                <div className="mb-3 flex items-start gap-2 bg-[#F1EFE8] text-[#5F5E5A] text-[13px] rounded-lg px-4 py-3 border border-[#D3D1C7]">
                    <span className="mt-px">⚠</span>
                    <span>This employee's account has been disabled. Records are visible for reference only. No actions can be taken.</span>
                </div>
            )}

            {/* Employee name — shown OUTSIDE the card (page body area, between Back and the card)
                only when a manager (HR/RM/Admin) opens a team member's timesheet. Personal
                "My Timesheet" has no employeeName, so nothing renders there. Display only. */}
            {weekData.employeeName && (
                <div className="mb-3 flex items-center gap-2 text-slate-900 text-[18px] font-semibold">
                    <svg className="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    {weekData.employeeName}
                </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-0 w-full animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-slate-900 text-white px-4 md:px-8 py-3 md:py-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <h2 className="text-sm md:text-base font-bold">Weekly Timesheet</h2>
                            <span className="sm:hidden bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full text-[8px] font-bold border border-indigo-500/30 mt-1 w-fit">
                                {weekData.startDate} - {weekData.endDate}
                            </span>
                        </div>
                        <span className="hidden sm:inline-block bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-500/30">
                            {weekData.startDate} - {weekData.endDate}
                        </span>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        {!readOnly ? (
                            <>
                                {/* Rule 2: Save the sheet as a draft without submitting for approval.
                                    Secondary/outline styling, placed to the LEFT of Submit Sheet. */}
                                {onSaveDraft && (
                                    <button
                                        onClick={handleDraftSave}
                                        className="flex-1 sm:flex-none px-4 md:px-5 py-2 rounded-lg text-[9px] md:text-[10px] font-bold transition-all tracking-widest uppercase border border-slate-500 text-slate-200 hover:bg-slate-700 hover:text-white active:scale-95"
                                    >
                                        SAVE
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={!!pendingLeaveMessage}
                                    className={`flex-1 sm:flex-none px-4 md:px-5 py-2 text-white rounded-lg text-[9px] md:text-[10px] font-bold transition-all shadow-lg tracking-widest uppercase ${pendingLeaveMessage
                                        ? 'bg-slate-400 cursor-not-allowed opacity-50 shadow-none'
                                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 active:scale-95'
                                        }`}
                                >
                                    SUBMIT SHEET
                                </button>
                            </>
                        ) : (weekData.status === 'Pending' && onApprove && onReject && !disabledAccount && String(employeeId) !== String(JSON.parse(localStorage.getItem("user"))?.employeeId)) && (
                            <>
                                <button onClick={() => onApprove(weekData)} className="flex-1 sm:flex-none px-4 md:px-5 py-2 bg-emerald-600 text-white rounded-lg text-[9px] md:text-[10px] font-bold hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 active:scale-95 tracking-widest uppercase">
                                    APPROVE
                                </button>
                                <button onClick={() => onReject(weekData)} className="flex-1 sm:flex-none px-4 md:px-5 py-2 bg-red-600 text-white rounded-lg text-[9px] md:text-[10px] font-bold hover:bg-red-500 transition-all shadow-lg shadow-red-600/20 active:scale-95 tracking-widest uppercase">
                                    REJECT
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto min-h-0 bg-slate-50 md:bg-white">
                    {pendingLeaveMessage && (
                        <div className="bg-slate-900 border-b border-slate-800 text-amber-400 px-4 md:px-8 pb-2 text-xs font-bold flex items-center gap-2 sticky top-0 z-30 animate-in slide-in-from-top duration-300">
                            <svg className="w-4 h-4 shrink-0 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="animate-pulse">{pendingLeaveMessage}</span>
                        </div>
                    )}
                    {/* Desktop View (Table) */}
                    <div className="hidden lg:block">
                        <table className="w-full border-collapse border border-slate-300">
                            <thead className="sticky top-0 z-20">
                                <tr className="bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider">
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[60px]">Project ID <span className="text-red-300">*</span></th>
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[80px]">Project Name <span className="text-red-300">*</span></th>
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[60px]">Task ID</th>
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[75px]">On/Off</th>
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[65px]">Billable</th>
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[65px]">Location</th>
                                    {dates.map((d, i) => {
                                        const header = formatDateHeader(d);
                                        const weekend = isWeekend(d);
                                        return (
                                            <th key={i} className={`p-1 border-r border-slate-700 text-center min-w-[35px] ${weekend ? 'bg-slate-900/60' : ''}`}>
                                                <div className="font-bold">{header.day}</div>
                                                <div className="opacity-60 text-[8px]">{header.name}</div>
                                            </th>
                                        );
                                    })}
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[40px]">Total</th>
                                    <th className="p-1 border-r border-slate-700 text-center min-w-[80px]">Comment</th>
                                    <th className="p-1 text-center min-w-[35px]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300">
                                {/* Project Rows */}
                                {projectRows.map((row, index) => (
                                    <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-0.5 border-r border-slate-300">
                                            <input type="text" value={row.projectId} maxLength={32} onChange={(e) => handleRowChange(index, 'projectId', e.target.value)} className="w-full p-1 text-[10px] border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white outline-none" />
                                        </td>
                                        <td className="p-0.5 border-r border-slate-300">
                                            <input type="text" value={row.projectName} maxLength={32} onChange={(e) => handleRowChange(index, 'projectName', e.target.value)} className="w-full p-1 text-[10px] border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white outline-none" />
                                        </td>
                                        <td className="p-0.5 border-r border-slate-300">
                                            <input type="text" value={row.taskId} maxLength={32} onChange={(e) => handleRowChange(index, 'taskId', e.target.value)} className="w-full p-1 text-[10px] border border-transparent hover:border-slate-200 focus:border-indigo-500 rounded bg-transparent focus:bg-white outline-none" />
                                        </td>
                                        <td className="p-0.5 border-r border-slate-300">
                                            <select value={row.onsite} onChange={(e) => handleRowChange(index, 'onsite', e.target.value)} className="w-full p-1 text-[10px] bg-transparent outline-none">
                                                <option>Onsite</option>
                                                <option>Offshore</option>
                                            </select>
                                        </td>
                                        <td className="p-0.5 border-r border-slate-300">
                                            <select value={row.billable} onChange={(e) => handleRowChange(index, 'billable', e.target.value)} className="w-full p-1 text-[10px] bg-transparent outline-none">
                                                <option>Billable</option>
                                                <option>Non-Billable</option>
                                            </select>
                                        </td>
                                        <td className="p-0.5 border-r border-slate-300">
                                            <select
                                                value={row.location}
                                                disabled={readOnly}
                                                onChange={(e) => handleRowChange(index, 'location', e.target.value)}
                                                className="w-full p-1 text-[10px] bg-transparent outline-none"
                                            >
                                                <option value="India">India</option>
                                                <option value="Japan">Japan</option>
                                                <option value="Singapore">Singapore</option>
                                            </select>
                                        </td>
                                        {row.hours.map((h, i) => {
                                            const weekend = isWeekend(dates[i]);
                                            const future = isFutureDate(dates[i]);
                                            const locked = weekend || readOnly || isHolidayDay(i) || future;
                                            return (
                                                <td key={i} className={`p-0.5 border-r border-slate-300 ${weekend || future ? 'bg-slate-100' : ''}`}>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        maxLength={2}
                                                        value={h.value}
                                                        disabled={locked}
                                                        title={future ? 'Future date — not available yet' : undefined}
                                                        onKeyDown={handleHoursKeyDown}
                                                        onChange={(e) => handleHourChange(index, i, e.target.value)}
                                                        className={`w-full p-1 text-[10px] text-center border border-transparent rounded bg-transparent outline-none font-bold ${locked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700 hover:border-slate-200 focus:border-indigo-500 focus:bg-white'}`}
                                                    />
                                                </td>
                                            );
                                        })}
                                        <td className="p-0.5 border-r border-slate-300 text-center font-black text-slate-700 text-[10px]">
                                            {calculateRowTotal(row.hours).toFixed(2)}
                                        </td>
                                        <td className="p-0.5 border-r border-slate-300">
                                            <input type="text" value={row.comment} maxLength={32} onChange={(e) => handleRowChange(index, 'comment', e.target.value)} className="w-full p-1 text-[10px] bg-transparent outline-none" />
                                        </td>
                                        <td className="p-0.5 text-center">
                                            {/* Delete row is only available while editing; the read-only detail/audit
                                                views (Admin/HR/RM/Employee) must not show a delete action. */}
                                            {!readOnly && (
                                                <button onClick={() => setProjectRows(projectRows.filter((_, idx) => idx !== index))} className="p-1 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}

                                {/* Special Rows Button */}
                                {!readOnly && (
                                    <tr className="bg-slate-50/50">
                                        <td colSpan="16" className="p-1.5 pl-4">
                                            <button onClick={handleAddRow} className="flex items-center gap-2 text-indigo-600 font-bold text-[10px] hover:text-indigo-700">
                                                <div className="w-4 h-4 bg-indigo-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 5v14M5 12h14" />
                                                    </svg>
                                                </div>
                                                <span>ADD PROJECT ROW</span>
                                            </button>
                                        </td>
                                    </tr>
                                )}

                                {/* TruTime / Leave section */}
                                <tr className="bg-slate-100/50 text-[9px] font-black uppercase text-slate-500">
                                    <td colSpan="6" className="p-2 pl-6 border-r border-slate-300">TruTime / Holiday / Leave</td>
                                    <td colSpan="7" className="p-2 border-r border-slate-300"></td>
                                    <td colSpan="3"></td>
                                </tr>

                                {/* Swipe Hours */}
                                <tr className="text-[11px]">
                                    <td colSpan="6" className="p-2 pl-10 text-slate-500 border-r border-slate-300 italic font-medium">Swipe in hours</td>
                                    {truTimeRows.swipe.map((h, i) => {
                                        const weekend = isWeekend(dates[i]);
                                        const future = isFutureDate(dates[i]);
                                        const locked = weekend || readOnly || isHolidayDay(i) || future;
                                        return (
                                            <td key={i} className={`p-0 border-r border-slate-300 h-8 ${weekend ? 'bg-slate-200' : future ? 'bg-slate-100' : 'bg-slate-50/30'}`}>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    maxLength={2}
                                                    value={h.value}
                                                    disabled={locked}
                                                    title={future ? 'Future date — not available yet' : undefined}
                                                    onKeyDown={handleHoursKeyDown}
                                                    onChange={(e) => handleSwipeChange(i, e.target.value)}
                                                    className={`w-full h-full text-center outline-none bg-transparent font-bold ${locked ? 'text-slate-400 cursor-not-allowed' : 'text-slate-400'}`}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td className="text-center font-bold text-slate-400">{calculateRowTotal(truTimeRows.swipe).toFixed(2)}</td>
                                    <td colSpan="2"></td>
                                </tr>

                                {/* Holiday Row */}
                                <tr className="text-[11px]">
                                    <td colSpan="6" className="p-2 pl-10 text-slate-500 border-r border-slate-300 italic font-medium">Holiday (Public/National)</td>
                                    {leaveRows.holiday.map((h, i) => {
                                        const isHoliday = isHolidayDay(i);
                                        return (
                                            <td key={i} className={`p-0 border-r border-slate-300 ${isHoliday ? 'bg-amber-100/50' : 'bg-amber-50/10'}`}>
                                                <input
                                                    type="text"
                                                    value={h.value}
                                                    disabled={true}
                                                    className={`w-full text-center h-full outline-none bg-transparent font-bold ${isHoliday ? 'text-amber-700' : 'text-amber-600/50'} cursor-not-allowed`}
                                                />
                                            </td>
                                        );
                                    })}
                                    <td className="text-center font-bold text-amber-600">{calculateRowTotal(leaveRows.holiday).toFixed(2)}</td>
                                    <td colSpan="2"></td>
                                </tr>

                                {/* Leave Rows S, C, E */}
                                {['S', 'C', 'E', 'L'].map((type, idx) => {
                                    const key = `leave${type}`;
                                    const labelMap = { 'S': 'Leave (Sick)', 'C': 'Leave (Casual)', 'E': 'Leave (Earned)', 'L': 'Leave (LOP)' };
                                    return (
                                        <tr key={type} className="text-[11px]">
                                            <td colSpan="6" className="p-2 pl-10 text-slate-500 border-r border-slate-300 italic font-medium">{labelMap[type]}</td>
                                            {leaveRows[key].map((h, i) => {
                                                return (
                                                    <td key={i} className={`p-0 border-r border-slate-300 bg-rose-50/10`}>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={h.value}
                                                            disabled={true}
                                                            onKeyDown={handleHoursKeyDown}
                                                            onChange={(e) => handleLeaveHourChange(key, i, e.target.value)}
                                                            className="w-full text-center h-full outline-none bg-transparent font-bold text-rose-600/60 cursor-not-allowed"
                                                        />
                                                    </td>
                                                );
                                            })}
                                            <td className="text-center font-bold text-rose-600/50">{calculateRowTotal(leaveRows[key]).toFixed(2)}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile/Tablet View (Cards) */}
                    <div className="lg:hidden p-4 space-y-6">
                        {/* Project Entries */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Project Entries</h3>
                                {!readOnly && (
                                    <button onClick={handleAddRow} className="text-indigo-600 text-[10px] font-bold">+ ADD ROW</button>
                                )}
                            </div>
                            {projectRows.map((row, index) => (
                                <div key={row.id} className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Proj ID <span className="text-red-500">*</span></label>
                                            <input type="text" value={row.projectId} maxLength={32} onChange={(e) => handleRowChange(index, 'projectId', e.target.value)} className="w-full p-2 text-xs bg-slate-50 rounded border-transparent border focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Proj Name <span className="text-red-500">*</span></label>
                                            <input type="text" value={row.projectName} maxLength={32} onChange={(e) => handleRowChange(index, 'projectName', e.target.value)} className="w-full p-2 text-xs bg-slate-50 rounded border-transparent border focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Task ID</label>
                                            <input type="text" value={row.taskId} maxLength={32} onChange={(e) => handleRowChange(index, 'taskId', e.target.value)} className="w-full p-2 text-xs bg-slate-50 rounded border-transparent border focus:border-indigo-500 outline-none" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                                            <select value={row.location} onChange={(e) => handleRowChange(index, 'location', e.target.value)} className="w-full p-2 text-xs bg-slate-50 rounded outline-none border-transparent border focus:border-indigo-500">
                                                <option value="India">India</option>
                                                <option value="Japan">Japan</option>
                                                <option value="Singapore">Singapore</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Hours</label>
                                        <div className="grid grid-cols-7 gap-1">
                                            {row.hours.map((h, i) => {
                                                const future = isFutureDate(dates[i]);
                                                const locked = isWeekend(dates[i]) || readOnly || isHolidayDay(i) || future;
                                                return (
                                                <div key={i} className="flex flex-col items-center">
                                                    <span className="text-[7px] font-bold text-slate-400 mb-1">
                                                        {formatDateHeader(dates[i])?.name?.charAt(0) || ''}
                                                    </span>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        maxLength={2}
                                                        value={h.value}
                                                        disabled={locked}
                                                        title={future ? 'Future date — not available yet' : undefined}
                                                        onKeyDown={handleHoursKeyDown}
                                                        onChange={(e) => handleHourChange(index, i, e.target.value)}
                                                        className={`w-full h-8 p-0 text-center text-[10px] font-bold rounded ${locked ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-indigo-50 text-indigo-700 border-indigo-200 border focus:border-indigo-500'} outline-none`}
                                                    />
                                                </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Total: <span className="text-slate-700">{calculateRowTotal(row.hours).toFixed(2)}</span></span>
                                        <button onClick={() => setProjectRows(projectRows.filter((_, idx) => idx !== index))} className="text-red-500 text-[10px] font-bold uppercase tracking-widest">Remove</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* TruTime & Leaves Mobile */}
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50">
                            <div className="p-4">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Leave & TruTime</h3>
                                <div className="space-y-4">
                                    {['swipe', 'holiday', 'leaveS', 'leaveC', 'leaveE', 'leaveL'].map((key) => {
                                        const labelMap = { 'leaveS': 'Leave (Sick)', 'leaveC': 'Leave (Casual)', 'leaveE': 'Leave (Earned)', 'leaveL': 'Leave (LOP)' };
                                        const label = key === 'swipe' ? 'TruTime Index' : key === 'holiday' ? 'Holidays' : labelMap[key];
                                        const data = key === 'swipe' ? truTimeRows.swipe : leaveRows[key];
                                        return (
                                            <div key={key} className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
                                                    <span className="text-[9px] font-bold text-slate-700">{calculateRowTotal(data).toFixed(2)}h</span>
                                                </div>
                                                <div className="grid grid-cols-7 gap-1">
                                                    {data.map((h, i) => {
                                                        const future = isFutureDate(dates[i]);
                                                        const locked = key === 'holiday' || key.startsWith('leave') || readOnly || isWeekend(dates[i]) || future;
                                                        return (
                                                        <input
                                                            key={i}
                                                            type="text"
                                                            inputMode="decimal"
                                                            maxLength={2}
                                                            value={h.value}
                                                            disabled={locked}
                                                            title={future ? 'Future date — not available yet' : undefined}
                                                            onKeyDown={handleHoursKeyDown}
                                                            onChange={(e) => key === 'swipe' ? handleSwipeChange(i, e.target.value) : handleLeaveHourChange(key, i, e.target.value)}
                                                            className={`w-full h-8 p-0 text-center text-[10px] font-bold rounded ${key === 'holiday' ? 'bg-amber-100/50 text-amber-700 cursor-not-allowed' : key.startsWith('leave') ? 'bg-rose-50 text-rose-600/60 cursor-not-allowed' : future ? 'bg-slate-100 text-slate-300 cursor-not-allowed' : 'bg-slate-50 text-slate-400'} border-transparent border outline-none`}
                                                        />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Summary */}
                <div className="bg-slate-900 text-white p-3 md:p-2 border-t border-slate-800 shrink-0">
                    <div className="flex justify-between sm:justify-end items-center max-w-6xl mx-auto px-4 md:px-8">
                        <div className="sm:hidden flex flex-col">
                            <span className="text-[7px] uppercase font-black text-slate-500">Submitting as</span>
                            <span className="text-[10px] font-bold text-slate-300">Employee</span>
                        </div>
                        <div className="text-right">
                            <p className="text-[8px] md:text-[9px] uppercase font-black text-slate-500 tracking-wider">Total Weekly Hours</p>
                            <p className="text-lg md:text-xl font-black text-emerald-400">
                                {getGrandTotal().toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WeeklyTimesheetGrid;
