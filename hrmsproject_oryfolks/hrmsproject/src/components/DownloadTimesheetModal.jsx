import React, { useState, useEffect } from "react";
import { X, Search, Download, CheckSquare, Square } from "lucide-react";
import api from "../utils/api";
import DateInput from "./DateInput";
import { toast } from "react-toastify";
import ExcelJS from "exceljs";

export default function DownloadTimesheetModal({ isOpen, onClose, employees }) {
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [selectedIds, setSelectedIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [generating, setGenerating] = useState(false);
    const [info, setInfo] = useState("");
    const [joiningError, setJoiningError] = useState("");
    const [joiningDates, setJoiningDates] = useState({});

    // Download list excludes ONLY Admin users (and the seeded System Admin).
    // Employee, HR, Reporting Manager and all other non-admin roles are included.
    const isAdminRole = (emp) => {
        const role = (emp?.role || "").toUpperCase();
        return role === "ADMIN" || (emp?.firstName === "System" && emp?.lastName === "Admin");
    };
    const eligibleEmployees = (employees || []).filter((e) => !isAdminRole(e));

    const MIN_DATE = "2001-01-01";
    const MAX_DATE = "2099-12-31";
    // Sanity bounds for the typed year (the field itself caps it at 4 digits).
    // Kept wider than MIN_DATE so an early date still reaches getDateError and
    // surfaces its toast instead of being silently discarded.
    const MIN_YEAR = 1900;
    const MAX_YEAR = 2099;
    // Returns an error message for a single date value, or null if valid.
    const getDateError = (value) => {
        if (!value) return null;
        if (value < MIN_DATE) return "Date cannot be earlier than 2001-01-01.";
        if (value > MAX_DATE) return "Date cannot be later than 2099-12-31.";
        return null;
    };
    // Validate only once the selection is confirmed (on blur), not on every keystroke.
    const handleDateBlur = (value) => {
        const err = getDateError(value);
        if (err) toast.error(err);
    };

    // Fetch joining dates for selected employees so the From Date can't precede them.
    useEffect(() => {
        const missing = selectedIds.filter((id) => !(id in joiningDates));
        if (missing.length === 0) return;
        let cancelled = false;
        (async () => {
            const updates = {};
            await Promise.all(missing.map(async (id) => {
                try {
                    const res = await api(`/api/employees/${id}`);
                    if (res.ok) {
                        const json = await res.json().catch(() => ({}));
                        const data = json.data || json || {};
                        const jd = data.joiningDate || data.hireDate || null;
                        updates[id] = jd ? String(jd).split("T")[0] : null;
                    } else {
                        updates[id] = null;
                    }
                } catch {
                    updates[id] = null;
                }
            }));
            if (!cancelled) setJoiningDates((prev) => ({ ...prev, ...updates }));
        })();
        return () => { cancelled = true; };
    }, [selectedIds]);

    // Earliest joining date among selected members → the minimum allowed From Date.
    const selectedJoining = selectedIds.map((id) => joiningDates[id]).filter(Boolean);
    const minFromDate = selectedJoining.length ? selectedJoining.reduce((m, d) => (d < m ? d : m)) : MIN_DATE;
    const formatDMY = (ymd) => { if (!ymd) return ""; const [y, m, d] = ymd.split("-"); return `${d}-${m}-${y}`; };

    if (!isOpen) return null;

    const filteredEmployees = eligibleEmployees.filter(emp =>
        emp.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.oryfolksId?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleToggleSelectAll = () => {
        const list = eligibleEmployees;
        if (selectedIds.length === list.length && list.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(list.map(e => e.id));
        }
    };

    const handleToggleEmployee = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDownload = async () => {
        if (!fromDate || !toDate) {
            toast.error("Please select a date range");
            return;
        }
        // Date range validation (2001-01-01 → 2099-12-31) — block download if invalid.
        const fromErr = getDateError(fromDate);
        if (fromErr) { toast.error(fromErr); return; }
        const toErr = getDateError(toDate);
        if (toErr) { toast.error(toErr); return; }
        if (fromDate > toDate) {
            toast.error("Invalid date range: From Date cannot be later than To Date.");
            return;
        }
        if (selectedIds.length === 0) {
            toast.error("Please select at least one employee");
            return;
        }
        if (fromDate && minFromDate !== MIN_DATE && fromDate < minFromDate) {
            setJoiningError(`Start date cannot be before the employee's joining date (${formatDMY(minFromDate)})`);
            return;
        }
        setJoiningError("");

        try {
            setGenerating(true);

            // Fetch a broad set of data using the working dashboard pattern to avoid 500 errors
            const year = new Date(fromDate).getFullYear();
            const [res, leavesRes, holidaysRes] = await Promise.all([
                api(`/api/timesheets?size=10000`),
                api(`/api/leaves`),
                api(`/api/holidays/year/${year}`)
            ]);

            let allRecords = [];
            if (res.ok) {
                const data = await res.json().catch(() => ({}));
                allRecords = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
            } else {
                toast.error(`Communication breakdown (${res.status}). generating placeholder report.`);
            }

            let allLeaves = [];
            if (leavesRes.ok) {
                const data = await leavesRes.json().catch(() => ({}));
                allLeaves = Array.isArray(data.data) ? data.data : [];
            }

            let allHolidays = [];
            if (holidaysRes.ok) {
                const data = await holidaysRes.json().catch(() => ({}));
                allHolidays = Array.isArray(data.data) ? data.data : [];
            }

            // Perform date filtering on the client side for maximum reliability
            // PERFORM LOCAL DATE PARSING TO AVOID TIMEZONE SHIFTS (treat YYYY-MM-DD as local midnight)
            const parseLocalDate = (dateStr) => {
                if (!dateStr) return null;
                const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
                return new Date(year, month - 1, day);
            };

            const startLimit = parseLocalDate(fromDate);
            const endLimit = parseLocalDate(toDate);

            const dateFilteredEntries = allRecords.filter(entry => {
                if (!entry.date) return false;
                const d = parseLocalDate(entry.date);
                if (startLimit && d < startLimit) return false;
                if (endLimit && d > endLimit) return false;
                return true;
            });

            // Empty range is allowed — an empty/template timesheet is still generated.
            const hasData = dateFilteredEntries.some((e) => selectedIds.includes(e.employeeId));
            setInfo(hasData ? "" : "No timesheet submissions found for this period. An empty timesheet will be downloaded.");

            // Generate a continuous list of dates between fromDate and toDate in LOCAL time
            const dateSequence = [];
            let curr = new Date(startLimit);
            while (curr <= endLimit) {
                const y = curr.getFullYear();
                const m = String(curr.getMonth() + 1).padStart(2, '0');
                const d = String(curr.getDate()).padStart(2, '0');
                dateSequence.push(`${y}-${m}-${d}`);
                curr.setDate(curr.getDate() + 1);
            }

            const finalExportList = [];

            // Ensure every selected employee has a record for EVERY date in the sequence
            selectedIds.forEach(id => {
                const emp = eligibleEmployees.find(e => e.id === id);
                const empName = emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
                const oryId = emp?.oryfolksId || "-";

                dateSequence.forEach(dateStr => {
                    const dayEntries = dateFilteredEntries.filter(e => e.employeeId === id && e.date === dateStr);

                    if (dayEntries.length > 0) {
                        finalExportList.push(...dayEntries.map(e => ({ ...e, oryfolksId: oryId })));
                    } else {
                        // Create an exhaustive placeholder for the missing date to keep the sequence intact
                        finalExportList.push({
                            id: "-",
                            employeeId: oryId, // Use Oryfolks ID as the identifier
                            employeeName: empName,
                            oryfolksId: oryId,
                            date: dateStr,
                            totalHours: 0,
                            project: "-",
                            projectName: "-",
                            task: "-",
                            taskDescription: "-",
                            category: "EMPTY",
                            status: "EMPTY",
                            billable: null,
                            onsiteOffshore: "-",
                            billingLocation: "-",
                            leaveType: "-"
                        });
                    }
                });
            });

            // Replace finalExportList CSV approach with downloadExcel
            await downloadExcel(dateSequence, selectedIds, dateFilteredEntries, allLeaves, allHolidays);
            toast.success("Excel Generated successfully.");
            if (hasData) onClose();
        } catch (error) {
            console.error(error);
            toast.error("An unexpected error occurred during generation.");
} finally {
            setGenerating(false);
        }
    };

    const downloadExcel = async (dateSequence, selectedIds, dateFilteredEntries, allLeaves, allHolidays) => {
        const workbook = new ExcelJS.Workbook();
        
        const monthsGrouped = {};
        const monthKeys = [];
        dateSequence.forEach(ds => {
            const d = new Date(ds);
            const monthName = d.toLocaleDateString("en-US", { month: "long" });
            const year = d.getFullYear();
            const key = `${monthName} ${year}`;
            if (!monthsGrouped[key]) {
                monthsGrouped[key] = {
                    monthName,
                    year,
                    dates: []
                };
                monthKeys.push(key);
            }
            monthsGrouped[key].dates.push(ds);
        });

        const uniqueYears = Array.from(new Set(dateSequence.map(ds => new Date(ds).getFullYear())));
        const useYearInSheetName = uniqueYears.length > 1;

        monthKeys.forEach((key) => {
            const group = monthsGrouped[key];
            const dates = group.dates;
            
            const sheetName = useYearInSheetName 
                ? `${group.monthName} ${group.year}`
                : group.monthName;

            const worksheet = workbook.addWorksheet(sheetName);

            const sD = new Date(dates[0]);
            const eD = new Date(dates[dates.length - 1]);
            const monthYear = sD.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase();
            const startStr = sD.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const endStr = eD.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

            const colCount = 6 + dates.length + 6;

            worksheet.mergeCells(1, 1, 1, colCount);
            const row1 = worksheet.getRow(1);
            row1.getCell(1).value = `ORYFOLKS PAYROLL SYSTEM — MONTHLY ATTENDANCE RECORD — ${monthYear} (Cycle: ${startStr} → ${endStr})`;
            row1.height = 30;
            row1.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
            row1.getCell(1).font = { color: { argb: "FF000000" }, bold: true, size: 14 };
            row1.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

            worksheet.mergeCells(2, 1, 2, colCount);
            const row2 = worksheet.getRow(2);
            row2.getCell(1).value = "P = Present   A = Absent   LOP = Loss Of Pay   HD = Half Day   WO = Week Off   PH = Public Holiday   |   Sat&Sun auto-marked WO   |   Source: Manual Upload";
            row2.height = 20;
            row2.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6B8B7" } };
            row2.getCell(1).font = { color: { argb: "FF000000" }, size: 10 };
            row2.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

            worksheet.mergeCells(3, 1, 3, 6);
            const row3 = worksheet.getRow(3);
            row3.getCell(1).value = "EMPLOYEE INFORMATION";
            row3.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC4BD97" } };
            row3.getCell(1).font = { color: { argb: "FF000000" }, bold: true };
            row3.getCell(1).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

            worksheet.mergeCells(3, 7, 3, 6 + dates.length);
            row3.getCell(7).value = `DAY WISE ATTENDANCE (${startStr} → ${endStr})`;
            row3.getCell(7).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC4BD97" } };
            row3.getCell(7).font = { color: { argb: "FF000000" }, bold: true };
            row3.getCell(7).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

            worksheet.mergeCells(3, 7 + dates.length, 3, colCount);
            row3.getCell(7 + dates.length).value = "MONTHLY SUMMARY";
            row3.getCell(7 + dates.length).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC4BD97" } };
            row3.getCell(7 + dates.length).font = { color: { argb: "FF000000" }, bold: true };
            row3.getCell(7 + dates.length).alignment = { horizontal: "center", vertical: "middle", wrapText: true };

            const row4 = worksheet.getRow(4);
            const row5 = worksheet.getRow(5);

            const baseHeaders = ["S.No", "Emp ID", "Name", "Department", "Month", "Year"];
            const summaryHeaders = ["Working Days", "Leave days", "Holidays", "WeekOff days", "LOP", "Att%"];

            baseHeaders.forEach((h, i) => {
                row4.getCell(i + 1).value = h;
                row5.getCell(i + 1).value = h;
                const leftAlign = (i + 1 === 3 || i + 1 === 4);
                [row4, row5].forEach(r => {
                    const c = r.getCell(i + 1);
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF95B3D7" } };
                    c.font = { bold: true };
                    c.alignment = { horizontal: leftAlign ? "left" : "center", vertical: "middle" };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            dates.forEach((ds, i) => {
                const colIdx = 7 + i;
                const d = new Date(ds);
                const dayNum = d.getDate();
                const dayStr = d.toLocaleDateString("en-US", { weekday: 'short' }).substring(0, 2);
                row4.getCell(colIdx).value = dayNum;
                row5.getCell(colIdx).value = dayStr;
                [row4, row5].forEach(r => {
                    const c = r.getCell(colIdx);
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF95B3D7" } };
                    c.font = { bold: true };
                    c.alignment = { horizontal: "center", vertical: "middle" };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            summaryHeaders.forEach((h, i) => {
                const colIdx = 7 + dates.length + i;
                row4.getCell(colIdx).value = h;
                row5.getCell(colIdx).value = h;
                [row4, row5].forEach(r => {
                    const c = r.getCell(colIdx);
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
                    c.font = { bold: true };
                    c.alignment = { horizontal: "center", vertical: "middle" };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                });
            });

            worksheet.getColumn(1).width = 6;
            worksheet.getColumn(2).width = 12;
            worksheet.getColumn(3).width = 25;
            worksheet.getColumn(4).width = 20;
            worksheet.getColumn(5).width = 10;
            worksheet.getColumn(6).width = 8;
            const headerText = `DAY WISE ATTENDANCE (${startStr} → ${endStr})`;
            const minHeaderWidth = headerText.length + 4;
            const dayColWidth = Math.max(4, Math.ceil(minHeaderWidth / dates.length));

            for (let i = 0; i < dates.length; i++) {
                worksheet.getColumn(7 + i).width = dayColWidth;
            }
            for (let i = 0; i < summaryHeaders.length; i++) {
                worksheet.getColumn(7 + dates.length + i).width = 12;
            }

            worksheet.views = [
                { state: 'frozen', xSplit: 0, ySplit: 3, topLeftCell: 'A4', activeCell: 'A4' }
            ];

            selectedIds.forEach((empId, empIdx) => {
                const emp = eligibleEmployees.find(e => e.id === empId);
                const rowIdx = 6 + empIdx;
                const r = worksheet.getRow(rowIdx);
                
                r.getCell(1).value = empIdx + 1;
                r.getCell(2).value = emp?.oryfolksId || `EMP${empId}`;
                r.getCell(3).value = `${emp?.firstName || ""} ${emp?.lastName || ""}`.trim();
                r.getCell(4).value = emp?.department || "Engineering";
                r.getCell(5).value = sD.toLocaleDateString("en-US", { month: "short" });
                r.getCell(6).value = sD.getFullYear();
                
                for(let i=1; i<=6; i++) {
                    const c = r.getCell(i);
                    c.alignment = { vertical: 'middle', horizontal: (i === 3 || i === 4) ? 'left' : 'center' };
                    c.font = { bold: i <= 3 };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    if (i <= 4) {
                        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE4DFEC" } };
                    } else {
                        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEBE4A9" } };
                    }
                }

                let presDays = 0, leaveDays = 0, holidays = 0, weekOffs = 0, lops = 0;
                const leaveReasons = [];

                dates.forEach((ds, i) => {
                    const colIdx = 7 + i;
                    const c = r.getCell(colIdx);
                    const dayEntries = dateFilteredEntries.filter(e => e.employeeId === empId && e.date === ds);
                    
                    const d = new Date(ds);
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    
                    let cellValue = isWeekend ? "WO" : "";
                    let comment = "";
                    let bgColor = isWeekend ? "FFD9D9D9" : "FFFFFFFF";
                    
                    let isSL = false, isCL = false, isEL = false, isLOP = false, isHalfDay = false, isWorked = false, isHoliday = false;
                    
                    let holidayName = "";
                    const matchingHoliday = allHolidays.find(h => {
                        const hDate = h.holidayDate ? h.holidayDate.split('T')[0] : "";
                        return hDate === ds;
                    });
                    if (matchingHoliday) {
                        holidayName = matchingHoliday.holidayName;
                    }

                    let leaveReason = "";
                    const matchingLeave = allLeaves.find(l => {
                        if (l.employeeId !== empId || l.status !== 'APPROVED') return false;
                        const lStart = l.startDate ? l.startDate.split('T')[0] : "";
                        const lEnd = l.endDate ? l.endDate.split('T')[0] : "";
                        return ds >= lStart && ds <= lEnd;
                    });
                    if (matchingLeave) {
                        leaveReason = matchingLeave.reason || "";
                    }

                    dayEntries.forEach(entry => {
                        const cat = String(entry.category || "").toUpperCase();
                        if (cat === 'LEAVE') {
                            if (entry.totalHours == 4) isHalfDay = true;
                            
                            const lType = String(entry.leaveType || "").toUpperCase();
                            const pName = String(entry.projectName || "").toUpperCase();
                            
                            if (lType === 'S' || pName.includes('SICK')) isSL = true;
                            else if (lType === 'C' || pName.includes('CASUAL')) isCL = true;
                            else if (lType === 'E' || pName.includes('EARNED')) isEL = true;
                            else if (lType === 'L' || pName.includes('LOP')) isLOP = true;
                            
                            const reasonText = entry.taskDescription || entry.notes || entry.reason || "";
                            if (!leaveReason && reasonText && reasonText !== "-") leaveReason = reasonText;
                            
                        } else if (cat === 'HOLIDAY') {
                            isHoliday = true;
                            if (!holidayName) {
                                holidayName = entry.projectName || entry.project || "Public Holiday";
                            }
                        } else if (cat === 'PROJECT' || cat === 'TRUTIME' || (entry.totalHours > 0 && cat !== 'LEAVE')) {
                            isWorked = true;
                        }
                    });

                    if (isHoliday) { 
                        cellValue = "PH"; 
                        comment = holidayName; 
                        bgColor = "FFFFC000"; 
                        holidays++; 
                    } else if (isHalfDay || isSL || isCL || isEL || isLOP) {
                        let typeName = "Leave";
                        if (isSL) typeName = "Sick Leave";
                        else if (isCL) typeName = "Casual Leave";
                        else if (isEL) typeName = "Earned Leave";
                        else if (isLOP) typeName = "Loss of Pay";

                        let cStr = `Leave type: ${typeName}`;
                        if (isHalfDay) {
                            let hdType = "Half Day";
                            if (matchingLeave && matchingLeave.sessionData && matchingLeave.sessionData[ds]) {
                                const sess = matchingLeave.sessionData[ds];
                                if (sess === 'MORNING') hdType = "Morning Half";
                                    else if (sess === 'AFTERNOON') hdType = "Afternoon Half";
                            }
                            cStr += `\nHalf day: ${hdType}`;
                        }
                        
                        cStr += `\nReason: ${leaveReason || "-"}`;
                        comment = cStr;
                        bgColor = "FFE26B0A";
                        
                        if (isHalfDay) {
                            cellValue = "HL"; 
                            leaveDays += 0.5; 
                            leaveReasons.push(`${ds} - Half Day Leave (${leaveReason || "-"})`); 
                        } else if (isSL) { 
                            cellValue = "A"; 
                            leaveDays++; 
                            leaveReasons.push(`${ds} - Sick Leave (${leaveReason || "-"})`); 
                        } else if (isCL) { 
                            cellValue = "A"; 
                            leaveDays++; 
                            leaveReasons.push(`${ds} - Casual Leave (${leaveReason || "-"})`); 
                        } else if (isEL) { 
                            cellValue = "A"; 
                            leaveDays++; 
                            leaveReasons.push(`${ds} - Earned Leave (${leaveReason || "-"})`); 
                        } else if (isLOP) { 
                            cellValue = "LOP"; 
                            lops++; 
                            leaveReasons.push(`${ds} - Loss of Pay (${leaveReason || "-"})`); 
                        }
                    } else if (isWorked) { 
                        cellValue = "P"; 
                        comment = ""; 
                        bgColor = "FFC4D79B"; 
                        presDays++; 
                    } else if (isWeekend) { 
                        cellValue = "WO"; 
                        comment = ""; 
                        bgColor = "FFD9D9D9"; 
                        weekOffs++; 
                    } else { 
                        cellValue = ""; 
                        comment = ""; 
                        bgColor = "FFFFFFFF"; 
                    }
                    
                    c.value = cellValue;
                    c.alignment = { horizontal: "center", vertical: "middle" };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
                    if (comment) {
                        c.note = comment;
                    }
                });

                const totalWorkingDays = dates.length - weekOffs - holidays;
                const attPerc = totalWorkingDays > 0 ? (presDays / totalWorkingDays) * 100 : 0;
                
                const sumStart = 7 + dates.length;
                const summaries = [presDays, leaveDays, holidays, weekOffs, lops, `${attPerc.toFixed(1)}%`];
                
                summaries.forEach((val, i) => {
                    const c = r.getCell(sumStart + i);
                    c.value = val;
                    c.alignment = { horizontal: "center", vertical: "middle" };
                    c.font = { bold: true };
                    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F1" } };
                    c.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                    
                    if (i === 1 && leaveReasons.length > 0) {
                        c.note = leaveReasons.join('\n');
                    }
                });
            });
        });

        const legendSheet = workbook.addWorksheet("Legend");
        legendSheet.getColumn(1).width = 20;
        legendSheet.getColumn(2).width = 15;
        legendSheet.getColumn(3).width = 40;

        legendSheet.getRow(1).values = ["Day Type", "Cell Value", "Background Color"];
        legendSheet.getRow(1).font = { bold: true };

        const legends = [
            ["Present / Working Day", "P", "FFC4D79B"],
            ["Weekend (Sat & Sun)", "WO", "FFD9D9D9"],
            ["Public / Office Holiday", "PH", "FFFFC000"],
            ["Sick Leave", "A", "FFE26B0A"],
            ["Casual Leave", "A", "FFE26B0A"],
            ["Earned Leave", "A", "FFE26B0A"],
            ["Half Day Leave", "HL", "FFE26B0A"],
            ["Loss of Pay", "LOP", "FFE26B0A"],
            ["Absent / No Entry", "A", "FFE26B0A"]
        ];

        legends.forEach((leg, i) => {
            const r = legendSheet.getRow(i + 2);
            r.getCell(1).value = leg[0];
            r.getCell(2).value = leg[1];
            r.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: leg[2] } };
        });

        // Generate and download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Timesheet_${fromDate}_to_${toDate}.xlsx`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-blue/40 backdrop-blur-md px-4">
            <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                <div className="p-6 border-b border-brand-blue/5 flex items-center justify-between bg-bg-slate/30">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-brand-blue rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <Download size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-brand-blue tracking-tight">Download Timesheets</h2>
                            <p className="text-[10px] font-black text-brand-blue/30 uppercase tracking-widest mt-0.5">Custom Export Protocol</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-brand-blue/5 rounded-xl transition-all"><X size={20} /></button>
                </div>

                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {/* Date Selection */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest ml-1">From Date</label>
                            <DateInput
                                min={minFromDate}
                                max={MAX_DATE}
                                minYear={MIN_YEAR}
                                maxYear={MAX_YEAR}
                                value={fromDate}
                                onChange={(e) => { setFromDate(e.target.value); setJoiningError(""); setInfo(""); }}
                                onBlur={(e) => handleDateBlur(e.target.value)}
                                className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 text-sm font-bold text-brand-blue outline-none transition-all"
                            />
                            {joiningError && <p className="text-red-500 text-[12px] mt-1 ml-1">{joiningError}</p>}
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest ml-1">To Date</label>
                            <DateInput
                                min={MIN_DATE}
                                max={MAX_DATE}
                                minYear={MIN_YEAR}
                                maxYear={MAX_YEAR}
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                onBlur={(e) => handleDateBlur(e.target.value)}
                                className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 text-sm font-bold text-brand-blue outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Employee Selection */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest ml-1">Select Employees</label>
                            <button
                                onClick={handleToggleSelectAll}
                                className="text-[10px] font-black text-brand-blue hover:text-brand-yellow uppercase tracking-widest transition-all"
                            >
                                {selectedIds.length === eligibleEmployees.length && eligibleEmployees.length > 0 ? "Deselect All" : "Select All"}
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/30 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search employees..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-bg-slate/50 border-2 border-transparent focus:border-brand-yellow rounded-2xl p-3.5 pl-11 text-sm font-bold text-brand-blue outline-none transition-all"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                            {filteredEmployees.map(emp => (
                                <div
                                    key={emp.id}
                                    onClick={() => handleToggleEmployee(emp.id)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedIds.includes(emp.id)
                                        ? "bg-brand-blue/5 border-brand-blue/20"
                                        : "bg-bg-slate/20 border-transparent hover:border-brand-blue/5"
                                        }`}
                                >
                                    {selectedIds.includes(emp.id) ? (
                                        <CheckSquare className="w-4 h-4 text-brand-blue" />
                                    ) : (
                                        <Square className="w-4 h-4 text-brand-blue/20" />
                                    )}
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black text-brand-blue tracking-tight">{emp.firstName} {emp.lastName}</span>
                                        <span className="text-[9px] font-bold text-brand-blue/30 uppercase tracking-widest">{emp.oryfolksId}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        {info && <p className="text-amber-600 text-[12px] ml-1">{info}</p>}
                    </div>
                </div>

                <div className="p-8 bg-bg-slate/30 border-t border-brand-blue/5 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-brand-blue/40 hover:text-brand-blue transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={generating}
                        className="px-10 py-4 bg-brand-blue text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-brand-blue/20 active:scale-95 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        {generating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download size={16} />
                                Generate Excel
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
