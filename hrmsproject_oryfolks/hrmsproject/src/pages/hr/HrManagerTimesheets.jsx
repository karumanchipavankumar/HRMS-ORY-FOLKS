
import React, { useState, useEffect } from "react";
import api from "../../utils/api";

import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import WeeklyTimesheetGrid from "../employee/timesheet/WeeklyTimesheetGrid";
import { getHrNavItems } from "../../utils/hrNav";
import { toast } from "react-toastify";
import { Search, Filter, Clock, Download } from "lucide-react";
import NotificationComponent from "../../components/NotificationComponent";
import DownloadTimesheetModal from "../../components/DownloadTimesheetModal";
import DisabledBadge from "../../components/DisabledBadge";

export default function HrManagerTimesheets() {
    const [activeTab, setActiveTab] = useState("timesheets");
    const [user, setUser] = useState({});
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [timesheets, setTimesheets] = useState([]);
    const [tsFilter, setTsFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [managers, setManagers] = useState([]);
    const [tsSubView, setTsSubView] = useState('summary'); // 'summary' or 'grid'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [groupedWeeks, setGroupedWeeks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem("user")) || {};
        setUser(userData);
        fetchData();

        const handleClickOutside = (event) => {
            if (!event.target.closest("#profile-dropdown-container")) {
                setIsProfileDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);

            // 1. Fetch Reporting Managers
            const managerRes = await api("/api/reporting-managers");
            const managersData = await managerRes.json();
            const managersList = Array.isArray(managersData) ? managersData : (managersData.data || []);
            setManagers(managersList);

            // 2. Fetch ALL timesheets
            const tsRes = await api("/api/timesheets?size=10000");

            if (tsRes.ok) {
                const tsJson = await tsRes.json();
                const allTs = tsJson.data || tsJson || [];

                if (Array.isArray(allTs)) {
                    // Filter to only include timesheets from the reporting managers
                    const managerIds = new Set(managersList.map(m => String(m.id || m.employeeId)));
                    const filteredTs = allTs.filter(ts => ts.employeeId && managerIds.has(String(ts.employeeId)));

                    setTimesheets(filteredTs);
                    const grouped = groupIntoWeeks(filteredTs);
                    setGroupedWeeks(grouped);
                }
            } else {
                console.error("Failed to fetch timesheets");
            }

            // 3. Fetch ALL employees for download modal
            const allEmpRes = await api("/api/employees");
            const allEmpJson = await allEmpRes.json();
            const allEmpList = allEmpJson.data || allEmpJson || [];
            setEmployees(allEmpList);
        } catch (err) {
            console.error("Error fetching data", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            navigate("/login");
        }
    };

    const handleApprove = async (id) => {
        try {
            const res = await api(`/api/timesheets/${id}/approve`, {
                method: 'POST',
                body: JSON.stringify({ reviewerId: user.id })
            });
            if (res.ok) {
                fetchData();
            } else {
                alert("Failed to approve timesheet");
            }
        } catch (e) {
            console.error(e);
            alert("Error approving timesheet");
        }
    };

    const handleReject = async (id) => {
        const reason = window.prompt("Enter rejection reason:");
        if (reason === null) return;
        try {
            const res = await api(`/api/timesheets/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reviewerId: user.id, reason })
            });
            if (res.ok) {
                fetchData();
            } else {
                alert("Failed to reject timesheet");
            }
        } catch (e) {
            console.error(e);
            alert("Error rejecting timesheet");
        }
    };

    const groupIntoWeeks = (data) => {
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

        const getSaturday = (d) => {
            const date = parseDateLocal(d);
            const day = date.getDay();
            const diff = (day + 1) % 7;
            date.setDate(date.getDate() - diff);
            date.setHours(0, 0, 0, 0);
            return date;
        };

        const formatShortDate = (date) => {
            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
            return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
        };

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

        data.forEach(entry => {
            const sat = getSaturday(entry.date);
            const weekKey = getLocalDateStr(sat);

            if (!weeksMap[weekKey]) {
                const fri = new Date(sat);
                fri.setDate(sat.getDate() + 6);
                weeksMap[weekKey] = {
                    weekKey,
                    start: sat,
                    end: fri,
                    startDateStr: formatShortDate(sat),
                    endDateStr: formatShortDate(fri),
                    employees: {}
                };
            }

            const week = weeksMap[weekKey];
            const empId = entry.employeeId;

            if (!week.employees[empId]) {
                week.employees[empId] = {
                    employeeId: empId,
                    employeeName: entry.employeeName,
                    employeeStatus: entry.employeeStatus || 'ACTIVE',
                    billableHrs: 0,
                    nonBillableHrs: 0,
                    timeOffHrs: 0,
                    status: 'Approved',
                    entries: []
                };
            }

            const empWeek = week.employees[empId];
            empWeek.entries.push(entry);

            if (entry.category === 'TRUTIME') { }
            else if (['HOLIDAY', 'TIMEOFF', 'LEAVE', 'Sick Leave', 'Casual Leave', 'Earned Leave'].some(c => entry.category?.includes(c))) empWeek.timeOffHrs += entry.totalHours;
            else if (entry.billable) empWeek.billableHrs += entry.totalHours;
            else empWeek.nonBillableHrs += entry.totalHours;

            if (entry.status === 'PENDING') {
                empWeek.status = entry.reapplyUsed ? 'Reapproval Pending' : 'Pending';
            } else if (entry.status === 'REAPPLY_REQUESTED' && empWeek.status !== 'Pending' && empWeek.status !== 'Reapproval Pending') {
                empWeek.status = 'Reapply Requested';
            } else if (entry.status === 'REJECTED' && empWeek.status !== 'Pending' && empWeek.status !== 'Reapproval Pending') {
                empWeek.status = 'Rejected';
            }
        });

        const result = Object.values(weeksMap).map(w => ({
            ...w,
            employeeList: Object.values(w.employees).sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        }));

        return result.sort((a, b) => b.start - a.start);
    };

    const handleApproveWeek = async (week) => {
        try {
            const pendingEntries = week.entries.filter(e => e.status === 'PENDING');
            if (pendingEntries.length === 0) {
                toast.info("No pending entries to approve.");
                return;
            }

            setLoading(true);
            for (const entry of pendingEntries) {
                await api(`/api/timesheets/${entry.id}/approve`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: user.id })
                });
            }
            toast.success(`Week approved for ${week.employeeName}`);
            await fetchData();
            setTsSubView('summary');
        } catch (err) {
            toast.error("Error approving week");
        } finally {
            setLoading(false);
        }
    };

    const handleRejectWeek = async (week) => {
        const reason = window.prompt("Enter rejection reason:");
        if (reason === null) return;

        try {
            const pendingEntries = week.entries.filter(e => e.status === 'PENDING');
            setLoading(true);
            for (const entry of pendingEntries) {
                await api(`/api/timesheets/${entry.id}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: user.id, reason })
                });
            }
            toast.success(`Week rejected for ${week.employeeName}`);
            await fetchData();
            setTsSubView('summary');
        } catch (err) {
            toast.error("Error rejecting week");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB');
    };

    const calculateDuration = (start, end) => {
        if (!start || !end) return "0.0";
        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        const startTotal = startH * 60 + startM;
        const endTotal = endH * 60 + endM;
        let diff = endTotal - startTotal;
        if (diff < 0) diff += 24 * 60;
        return (diff / 60).toFixed(1);
    };

    const formatTime12h = (time24) => {
        if (!time24) return "—";
        const [hours, minutes] = time24.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        const m = minutes.toString().padStart(2, '0');
        return `${h12}:${m} ${ampm}`;
    };

    const navItems = getHrNavItems();

    return (
        <div className="flex min-h-screen bg-bg-slate font-brand text-brand-blue">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleLogout={handleLogout}
                navItems={navItems}
                hideLogout={true}
            />

            <main className="flex-1 flex flex-col">
                <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-brand-blue/5">
                    <div className="flex items-center gap-6">
                        <div className="w-11 h-11 bg-brand-blue/5 rounded-xl flex items-center justify-center border border-brand-blue/10 shadow-sm overflow-hidden">
                            <svg
                                className="w-7 h-7 text-brand-blue/20"
                                viewBox="0 0 24 24"
                                fill="currentColor"
                            >
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-brand-blue tracking-tight">
                                Team Timesheets
                            </h1>
                            <p className="text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
                                {user.designation || "Human Resources Operations"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 relative" id="profile-dropdown-container">
                        <NotificationComponent />
                        <button
                            onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                            className="w-10 h-10 rounded-full border-2 border-brand-blue/10 overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-md flex items-center justify-center bg-white p-0"
                            title="View Profile"
                        >
                            {user.photoPath ? (
                                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                <svg className="w-6 h-6 text-brand-blue/20" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                </svg>
                            )}
                        </button>

                        {/* Dropdown Menu */}
                        {isProfileDropdownOpen && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-brand-blue/5 p-5 z-[100] animate-in fade-in zoom-in duration-200 origin-top-right">
                                {/* User Info Header */}
                                <div className="space-y-3.5 text-left mb-4">
                                    <div>
                                        <p className="text-[9px] font-black text-brand-blue/40 uppercase tracking-[0.15em] mb-1">
                                            Employee Name
                                        </p>
                                        <p className="text-sm font-extrabold text-brand-blue tracking-tight">
                                            {user.fullName || "—"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-brand-blue/40 uppercase tracking-[0.15em] mb-1">
                                            Reporting Manager
                                        </p>
                                        <p className="text-sm font-extrabold text-brand-blue tracking-tight">
                                            {user.reportingManagerName || "N/A"}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-brand-blue/40 uppercase tracking-[0.15em] mb-1">
                                            HR Coordinator
                                        </p>
                                        <p className="text-sm font-extrabold text-brand-blue tracking-tight">
                                            {user.hrName || "N/A"}
                                        </p>
                                    </div>
                                </div>

                                <div className="h-px bg-brand-blue/5 my-4"></div>

                                {/* Adjacent Buttons */}
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => {
                                            navigate("/hr?tab=profile");
                                            setIsProfileDropdownOpen(false);
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-brand-blue/5 hover:bg-brand-blue hover:text-white text-xs font-black uppercase tracking-wider text-brand-blue rounded-xl transition-all shadow-sm active:scale-95 duration-200"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                            <circle cx="12" cy="7" r="4"></circle>
                                        </svg>
                                        Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsProfileDropdownOpen(false);
                                            handleLogout();
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-red-50 hover:bg-red-500 hover:text-white text-xs font-black uppercase tracking-wider text-red-500 rounded-xl transition-all shadow-sm active:scale-95 duration-200"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                                            <polyline points="16 17 21 12 16 7"></polyline>
                                            <line x1="21" y1="12" x2="9" y2="12"></line>
                                        </svg>
                                        Logout
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex-1 p-4 md:py-2 md:px-10">
                    <div className="max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {tsSubView === 'summary' ? (
                            <>
                                <div className="flex justify-end mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue/40">Status</span>
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="px-3 py-2 bg-white border border-brand-blue/10 rounded-xl text-[11px] font-bold text-brand-blue outline-none focus:border-brand-blue/30 transition-all cursor-pointer shadow-sm"
                                        >
                                            <option value="ALL">All</option>
                                            <option value="PENDING">Pending</option>
                                            <option value="APPROVED">Approved</option>
                                            <option value="REJECTED">Rejected</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-white rounded-[24px] p-4 shadow-xl border border-brand-blue/5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
                                    <div className="flex bg-bg-slate/50 p-1.5 rounded-2xl overflow-x-auto scrollbar-hide flex-shrink-0 w-full lg:w-auto">
                                        <div className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-brand-blue text-white shadow-lg shadow-brand-blue/20">
                                            Reporting Managers
                                        </div>
                                    </div>

                                    <div className="flex-1 relative w-full lg:w-auto lg:min-w-[300px]">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue/20" size={16} />
                                        <input
                                            type="text"
                                            placeholder="Search by manager name, ID or office..."
                                            value={tsFilter}
                                            onChange={(e) => setTsFilter(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 bg-bg-slate/50 border border-brand-blue/5 rounded-2xl text-[11px] font-bold outline-none focus:border-brand-blue/20 transition-all placeholder:text-brand-blue/20"
                                        />
                                    </div>

                                    <button
                                        onClick={() => setIsDownloadModalOpen(true)}
                                        className="bg-brand-blue text-white px-3 py-3 rounded-2xl shadow-xl shadow-brand-blue/10 active:scale-95 transition-all flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:brightness-110 w-full lg:w-auto"
                                    >
                                        <Download size={14} />
                                        Download Timesheet
                                    </button>
                                </div>

                                <div className="space-y-8">
                                    {loading ? (
                                        <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-[32px] border border-brand-blue/5 shadow-sm">
                                            <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                                            <p className="text-brand-blue/40 font-bold uppercase tracking-widest text-[10px]">Processing Manager Data...</p>
                                        </div>
                                    ) : groupedWeeks.length === 0 ? (
                                        <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-brand-blue/5">
                                            <p className="text-brand-blue/20 font-bold uppercase tracking-widest text-xs italic">No manager timesheet records found.</p>
                                        </div>
                                    ) : (
                                        groupedWeeks
                                            .map(week => {
                                                 const filteredEmployees = week.employeeList.filter(emp => {
                                                     const profile = employees.find(e => String(e.id) === String(emp.employeeId));
                                                     if (statusFilter !== "ALL" && (emp.status || "").toUpperCase() !== statusFilter) return false;
                                                     return !tsFilter ||
                                                         emp.employeeName.toLowerCase().includes(tsFilter.toLowerCase()) ||
                                                         emp.employeeId.toString().includes(tsFilter) ||
                                                         (profile?.oryfolksId && profile.oryfolksId.toLowerCase().includes(tsFilter.toLowerCase()));
                                                 });
                                                return { ...week, filteredEmployees };
                                            })
                                            .filter(week => week.filteredEmployees.length > 0)
                                            .map((week, wIdx) => (
                                                <div key={wIdx} className="bg-white rounded-[32px] shadow-xl border border-brand-blue/5 overflow-hidden">
                                                    <div className="bg-white p-3 px-6 flex items-center justify-between border-b border-brand-blue/5">
                                                        <div>
                                                            <h3 className="text-brand-blue font-black text-sm tracking-tight uppercase">Week of {week.startDateStr}</h3>
                                                            <p className="text-brand-blue/40 text-[9px] font-bold uppercase tracking-widest leading-none">{week.startDateStr} — {week.endDateStr}</p>
                                                        </div>
                                                        <div className="bg-brand-blue/5 px-3 py-1 rounded-lg border border-brand-blue/10">
                                                            <span className="text-brand-blue font-black text-xs">{week.filteredEmployees.length}</span>
                                                            <span className="text-brand-blue/40 text-[8px] font-bold uppercase tracking-widest ml-2">Managers Recorded</span>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 grid grid-cols-1 gap-2">
                                                        {week.filteredEmployees.map((emp, eIdx) => {
                                                            const isDisabled = emp.employeeStatus === 'INACTIVE' || emp.employeeStatus === 'DISABLED';
                                                            return (
                                                            <div
                                                                key={eIdx}
                                                                onClick={() => {
                                                                    setSelectedWeek({
                                                                        ...week,
                                                                        entries: emp.entries,
                                                                        status: emp.status,
                                                                        employeeId: emp.employeeId,
                                                                        employeeName: emp.employeeName,
                                                                        employeeStatus: emp.employeeStatus,
                                                                        startDate: week.startDateStr,
                                                                        endDate: week.endDateStr
                                                                    });
                                                                    setTsSubView('grid');
                                                                }}
                                                                className={`group p-4 rounded-2xl flex items-center gap-4 border border-transparent transition-all cursor-pointer ${isDisabled ? 'bg-[#F1EFE8]' : 'bg-bg-slate/30 hover:bg-white hover:border-brand-blue/10 hover:shadow-xl hover:shadow-brand-blue/5'}`}
                                                            >
                                                                <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black transition-all shadow-sm ${isDisabled ? 'text-brand-blue/20' : 'text-brand-blue/30 group-hover:bg-brand-blue group-hover:text-white'}`}>
                                                                    {emp.employeeName?.[0]}
                                                                </div>

                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className={`font-black text-sm uppercase tracking-tight ${isDisabled ? 'text-brand-blue/40' : 'text-brand-blue'}`}>{emp.employeeName}</h4>
                                                                        <span className="text-[10px] font-bold text-brand-blue/20 uppercase tracking-widest">ID: {(() => {
                                                                             const profile = employees.find(e => String(e.id) === String(emp.employeeId));
                                                                             return profile?.oryfolksId || emp.employeeId;
                                                                         })()}</span>
                                                                        {isDisabled && <DisabledBadge />}
                                                                    </div>
                                                                    <div className="flex items-center gap-3 mt-1">
                                                                        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${emp.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                                                                            emp.status === 'Rejected' ? 'bg-rose-100 text-rose-600' :
                                                                                'bg-amber-100 text-amber-600'
                                                                            }`}>
                                                                            {emp.status}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className={`hidden md:flex items-center gap-6 pr-6 ${isDisabled ? 'opacity-60 grayscale' : ''}`}>
                                                                    <div className="text-center">
                                                                        <p className="text-xs font-black text-brand-blue">{emp.billableHrs.toFixed(1)}</p>
                                                                        <p className="text-[8px] font-black text-brand-blue/20 uppercase tracking-widest">Billable</p>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <p className="text-xs font-black text-brand-blue">{emp.nonBillableHrs.toFixed(1)}</p>
                                                                        <p className="text-[8px] font-black text-brand-blue/20 uppercase tracking-widest">Non-Bill</p>
                                                                    </div>
                                                                    <div className="text-center border-l border-brand-blue/5 pl-6">
                                                                        <p className="text-sm font-black text-indigo-600">{(emp.billableHrs + emp.nonBillableHrs + emp.timeOffHrs).toFixed(1)}</p>
                                                                        <p className="text-[8px] font-black text-indigo-600/30 uppercase tracking-widest">Total</p>
                                                                    </div>
                                                                </div>

                                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-blue/20 group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                                                    </svg>
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col gap-6">
                                <WeeklyTimesheetGrid
                                    weekData={selectedWeek}
                                    employeeId={selectedWeek.employeeId}
                                    readOnly={true}
                                    approvedLeaves={[]}
                                    disabledAccount={selectedWeek?.employeeStatus === 'INACTIVE' || selectedWeek?.employeeStatus === 'DISABLED'}
                                    onBack={() => setTsSubView('summary')}
                                    onApprove={() => handleApproveWeek(selectedWeek)}
                                    onReject={() => handleRejectWeek(selectedWeek)}
                                />
                                <div className="flex justify-end gap-4 p-8 bg-white rounded-[32px] border border-brand-blue/5 shadow-xl">
                                    <p className="text-xs font-bold text-brand-blue/30 italic uppercase">
                                        Audit recorded for {selectedWeek.employeeName} — Week of {selectedWeek.startDate}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <DownloadTimesheetModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
                employees={employees}
            />
        </div>
    );
}
