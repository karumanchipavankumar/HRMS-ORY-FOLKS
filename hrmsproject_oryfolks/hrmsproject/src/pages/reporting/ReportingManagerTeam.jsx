import React, { useState, useEffect } from "react";
import api from "../../utils/api";

import { useNavigate, useLocation } from "react-router-dom";
import Logo from '../../assets/ORYFOLKS-logo.png';
import WeeklyTimesheetGrid from "../employee/timesheet/WeeklyTimesheetGrid";
import { toast } from "react-toastify";
import Sidebar from "../../components/Sidebar";
import { getRmNavItems } from "../../utils/rmNav";
import { Eye } from "lucide-react";
import LeaveDetailsModal from "../../components/LeaveDetailsModal";
import LeaveDecisionButtons from "../../components/LeaveDecisionButtons";
import NotificationComponent from "../../components/NotificationComponent";


export default function ReportingManagerTeam() {
    const navigate = useNavigate();
    const location = useLocation();
    const [teamMembers, setTeamMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [view, setView] = useState('team'); // 'team', 'timesheets', or 'leaves'
    const [leaves, setLeaves] = useState([]);
    const [leavesLoading, setLeavesLoading] = useState(false);
    const [leavesError, setLeavesError] = useState(null);
    const [leavesFilter, setLeavesFilter] = useState("");
    const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL");
    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    const initialManagerId = storedUser.employeeId || storedUser.id || storedUser.userId || null;

    const [managerId, setManagerId] = useState(initialManagerId);
    const [userLoading, setUserLoading] = useState(!initialManagerId);
    const [teamTimesheets, setTeamTimesheets] = useState([]);
    const [tsLoading, setTsLoading] = useState(false);
    const [tsError, setTsError] = useState(null);
    const [tsFilter, setTsFilter] = useState("");
    const [tsStatusFilter, setTsStatusFilter] = useState("ALL");
    const [user, setUser] = useState(storedUser);
    const [tsSubView, setTsSubView] = useState('summary'); // 'summary' or 'grid'
    const [selectedWeek, setSelectedWeek] = useState(null);
    const [groupedWeeks, setGroupedWeeks] = useState([]);
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    // Id of the leave whose decision is currently being submitted (one-time / dup guard)
    const [processingId, setProcessingId] = useState(null);


    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const viewParam = params.get('view');
        if (viewParam && ['team', 'timesheets', 'leaves'].includes(viewParam)) {
            setView(viewParam);
            if (viewParam === 'timesheets' && managerId) fetchTeamTimesheets(managerId);
            if (viewParam === 'leaves' && managerId) fetchLeaves(managerId);
        }
    }, [location.search, managerId]);

    useEffect(() => {
        if (managerId) {
            fetchTeam(managerId);
        }

        const fetchEmployeeProfile = async () => {
            try {
                const response = await api("/api/me/employee");
                if (response.ok) {
                    const result = await response.json();
                    const employeeData = result.data || result;
                    if (employeeData && employeeData.id) {
                        setManagerId(employeeData.id);
                        if (!managerId) fetchTeam(employeeData.id);

                        const stored = JSON.parse(localStorage.getItem("user")) || {};
                        const newUser = {
                            ...stored,
                            firstName: employeeData.firstName || stored.firstName,
                            lastName: employeeData.lastName || stored.lastName,
                            fullName: employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName}` : (stored.fullName || "Reporting Manager"),
                            designation: employeeData.designation || stored.designation,
                            role: stored.role || "REPORTING_MANAGER",
                            reportingManagerName: employeeData.reportingManagerName || stored.reportingManagerName || "N/A",
                            hrName: employeeData.hrName || stored.hrName || "N/A"
                        };
                        setUser(newUser);
                        localStorage.setItem("user", JSON.stringify(newUser));
                        setUserLoading(false);
                    }
                }
            } catch (err) {
                console.error("🔴 Error fetching employee profile:", err);
            } finally {
                setUserLoading(false);
            }
        };

        fetchEmployeeProfile();
        const handleClickOutside = (event) => {
            if (!event.target.closest("#profile-dropdown-container")) {
                setIsProfileDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [managerId]);


    const fetchLeaves = async (managerId) => {
        setLeavesLoading(true);
        setLeavesError(null);
        try {
            const res = await api(`/api/leaves/manager/${managerId}/team-leaves`);
            if (res.ok) {
                let api = await res.json();
                let data = (api && api.data) ? api.data : [];
                data = (data || []).sort((a, b) => {
                    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
                    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
                    return new Date(b.startDate) - new Date(a.startDate);
                });
                setLeaves(data);
            } else {
                setLeavesError("Failed to load leaves. Try again later.");
            }
        } catch (err) {
            setLeavesError("Server error. Try again later.");
        } finally {
            setLeavesLoading(false);
        }
    };

    const handleApproveLeave = async (leaveId) => {
        // One-time enforcement: block if a decision submission is already in flight
        if (processingId) return;
        setProcessingId(leaveId);
        try {
            const res = await api(`/api/leaves/${leaveId}/approve`, {
                method: 'POST',
                body: JSON.stringify({ approverId: managerId })
            });
            if (res.ok) {
                toast.success("Leave approved successfully.");
                await fetchLeaves(managerId);
            } else {
                toast.error("Failed to approve leave");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error approving leave");
        } finally {
            setProcessingId(null);
        }
    };

    const handleRejectLeave = async (leaveId) => {
        if (processingId) return;
        const reason = window.prompt("Enter rejection reason:", "Rejected by manager");
        if (reason === null) return;
        if (reason.length > 255) {
            toast.error("Rejection reason cannot exceed 255 characters");
            return;
        }
        setProcessingId(leaveId);
        try {
            const res = await api(`/api/leaves/${leaveId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ approverId: managerId, reason: reason || "Rejected by manager" })
            });
            if (res.ok) {
                toast.success("Leave rejected successfully.");
                await fetchLeaves(managerId);
            } else {
                toast.error("Failed to reject leave");
            }
        } catch (err) {
            console.error(err);
            toast.error("Error rejecting leave");
        } finally {
            setProcessingId(null);
        }
    };

    const fetchTeamTimesheets = async (managerId) => {
        setTsLoading(true);
        setTsError(null);
        try {
            const res = await api(`/api/timesheets/manager/${managerId}/team-timesheets`);
            if (res.ok) {
                const api = await res.json();
                const allEntries = api.data || [];
                setTeamTimesheets(allEntries);
                const grouped = groupTeamIntoWeeks(allEntries);
                setGroupedWeeks(grouped);
            } else {
                setTsError("Failed to load team timesheets.");
            }
        } catch (err) {
            setTsError("Server error loading timesheets.");
        } finally {
            setTsLoading(false);
        }
    };

    const fetchTeam = async (managerId) => {
        setLoading(true);
        setError(null);
        try {
            const res = await api(`/api/reporting-managers/${managerId}`);
            if (res.ok) {
                const data = await res.json();
                const team = (data.team || []).filter(member => member.id !== managerId);
                setTeamMembers(team);
            } else {
                setError("Failed to load team data. Please try again later.");
            }
        } catch (err) {
            console.error("Error fetching team:", err);
            setError("Server connection failed. Please check your network.");
        } finally {
            setLoading(false);
        }
    };

    const handleApproveTimesheet = async (id) => {
        try {
            const response = await api(`/api/timesheets/${id}/approve`, {
                method: 'POST',
                body: JSON.stringify({ reviewerId: managerId, comments: "Approved by manager" })
            });
            if (response.ok) {
                if (managerId) fetchTeamTimesheets(managerId);
            }
        } catch (err) {
            console.error("Error approving timesheet:", err);
        }
    };

    const handleRejectTimesheet = async (id) => {
        const reason = window.prompt("Enter reason for rejection:", "Rejected by manager");
        if (reason === null) return;
        try {
            const response = await api(`/api/timesheets/${id}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reviewerId: managerId, reason: reason })
            });
            if (response.ok) {
                if (managerId) fetchTeamTimesheets(managerId);
            }
        } catch (err) {
            console.error("Error rejecting timesheet:", err);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            window.location.href = "/login";
        }
    };


    const formatDate = (dateString) => {
        if (!dateString) return "";
        return new Date(dateString).toLocaleDateString('en-GB');
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const calculateLeaveDays = (startDate, endDate) => {
        if (!startDate || !endDate) return 1;
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const diffTime = Math.abs(end - start);
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        } catch (e) {
            return 1;
        }
    };

    const groupTeamIntoWeeks = (data) => {
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

            if (entry.status === 'PENDING') empWeek.status = 'Pending';
            else if (entry.status === 'REJECTED' && empWeek.status !== 'Pending') empWeek.status = 'Rejected';
        });

        const result = Object.values(weeksMap).map(w => ({
            ...w,
            employeeList: Object.values(w.employees).sort((a, b) => (a.employeeName || "").localeCompare(b.employeeName || ""))
        }));
        return result.sort((a, b) => b.start - a.start);
    };

    const handleApproveWeek = async (week) => {
        try {
            const pendingEntries = week.entries.filter(e => e.status === 'PENDING');
            if (pendingEntries.length === 0) {
                toast.info("No pending entries to approve in this week.");
                return;
            }
            setTsLoading(true);
            for (const entry of pendingEntries) {
                await api(`/api/timesheets/${entry.id}/approve`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: managerId, comments: "Approved by manager" })
                });
            }
            toast.success(`Week approved for ${week.employeeName}`);
            await fetchTeamTimesheets(managerId);
            setTsSubView('summary');
        } catch (err) {
            toast.error("Error approving week");
        } finally {
            setTsLoading(false);
        }
    };

    const handleRejectWeek = async (week) => {
        const reason = window.prompt("Enter reason for rejection:", "Rejected by manager");
        if (reason === null) return;
        try {
            const pendingEntries = week.entries.filter(e => e.status === 'PENDING');
            setTsLoading(true);
            for (const entry of pendingEntries) {
                await api(`/api/timesheets/${entry.id}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ reviewerId: managerId, reason: reason })
                });
            }
            toast.success(`Week rejected for ${week.employeeName}`);
            await fetchTeamTimesheets(managerId);
            setTsSubView('summary');
        } catch (err) {
            toast.error("Error rejecting week");
        } finally {
            setTsLoading(false);
        }
    };

    const navItems = getRmNavItems(view === 'team' ? 'team' : view === 'timesheets' ? 'team-timesheets' : 'team-leaves');

    return (
        <div className="flex flex-col md:flex-row w-full min-h-screen bg-bg-slate font-brand text-brand-blue">
            <Sidebar
                activeTab={view === 'team' ? 'team' : view === 'timesheets' ? 'team-timesheets' : 'team-leaves'}
                setActiveTab={(tab) => {
                    if (tab === 'team') setView('team');
                    else if (tab === 'team-timesheets') setView('timesheets');
                    else if (tab === 'team-leaves') setView('leaves');
                }}
                handleLogout={handleLogout}
                navItems={navItems}
                hideLogout={true}
            />


            <main className="flex-1 flex flex-col h-full overflow-hidden">
                <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-30 border-b border-brand-blue/5">
                    <div className="flex items-center gap-6">
                        <div className="w-11 h-11 bg-brand-blue/5 rounded-xl flex items-center justify-center border border-brand-blue/10 shadow-sm overflow-hidden text-sm font-black text-brand-blue">
                            {user.photoPath ? (
                                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                (user.firstName?.[0] || user.fullName?.[0]) || "M"
                            )}
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-brand-blue tracking-tight">
                                {view === 'team' ? 'Team Members' : view === 'timesheets' ? 'Team Timesheets' : 'Leave Administration'}
                            </h1>
                            <p className="text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
                                {user.designation || "Reporting Manager"} — {view === 'team' ? 'Directory View' : view === 'timesheets' ? 'Performance Audit' : 'Absence Management'}
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
                                            navigate("/reporting-dashboard?tab=profile");
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

                <div className="flex-1 p-4 md:p-8 overflow-y-auto">
                    {view === 'team' && (
                        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-xl border border-brand-blue/5 p-6 md:p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-yellow/5 rounded-full -mr-32 -mt-32 blur-3xl pointer-events-none" />
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {loading ? (
                                    <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4">
                                        <div className="w-12 h-12 border-4 border-brand-yellow/30 border-t-brand-yellow rounded-full animate-spin" />
                                        <p className="text-brand-blue/40 font-bold uppercase tracking-widest text-[10px]">Fetching Team Members...</p>
                                    </div>
                                ) : error ? (
                                    <div className="col-span-full py-20 text-center space-y-4">
                                        <div className="text-red-500 font-bold uppercase tracking-widest text-xs">{error}</div>
                                        <button onClick={() => fetchTeam(managerId)} className="btn-primary text-[10px]">Retry</button>
                                    </div>
                                ) : teamMembers.length === 0 ? (
                                    <div className="col-span-full py-20 text-center">
                                        <p className="text-brand-blue/30 font-bold uppercase tracking-widest text-xs italic">No team members assigned yet.</p>
                                    </div>
                                ) : (
                                    teamMembers.map((member) => (
                                        <div key={member.id} className="bg-bg-slate p-6 rounded-2xl border border-brand-blue/5 flex flex-col items-center text-center group card-hover relative">
                                            <div className="w-14 h-14 bg-white rounded-2xl mb-4 flex items-center justify-center p-3 text-brand-blue/20 group-hover:bg-brand-yellow group-hover:text-brand-blue transition-all duration-300 shadow-sm border border-brand-blue/5">
                                                <svg fill="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                                                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                                </svg>
                                            </div>
                                            <h2 className="text-sm font-bold text-brand-blue leading-tight mb-0.5">{member.name || member.fullName}</h2>
                                            {member.active === false && (
                                                <span className="inline-flex px-2 py-0.5 mb-1 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED</span>
                                            )}
                                            <p className="text-[10px] text-brand-blue/40 font-bold mb-4 tracking-wider">ID: {member.oryfolksId || member.id}</p>
                                            <div className="w-full space-y-3 pt-4 border-t border-brand-blue/5 mt-auto">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[8px] uppercase font-bold text-brand-blue/30 tracking-[0.2em] mb-1">Position</span>
                                                    <span className="text-[11px] font-bold text-brand-blue/70 leading-tight">{member.role || "Employee"}</span>
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-[10px] font-semibold text-brand-blue/50 truncate w-full px-2">{member.corporateEmail || "Not Available"}</span>
                                                    <button onClick={() => navigate(`/admin/employee/${member.id}`)} className="w-full py-2 bg-brand-blue text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-blue-hover transition-all active:scale-95 shadow-md">View Profile</button>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                    {view === 'timesheets' && (
                        <div className="max-w-[1200px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {tsSubView === 'summary' ? (
                                <>
                                    <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-4 mb-8">
                                        <input type="text" placeholder="Filter by Name or ID..." value={tsFilter} onChange={(e) => setTsFilter(e.target.value)} className="w-full sm:w-64 h-10 bg-white border border-brand-blue/10 rounded-xl px-4 text-xs font-bold text-brand-blue outline-none focus:ring-2 focus:ring-brand-blue/5 shadow-sm" />
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue/40">Status</span>
                                            <select
                                                value={tsStatusFilter}
                                                onChange={(e) => setTsStatusFilter(e.target.value)}
                                                className="px-3 py-2 bg-white border border-brand-blue/10 rounded-xl text-[11px] font-bold text-brand-blue outline-none focus:border-brand-blue/30 transition-all cursor-pointer shadow-sm"
                                            >
                                                <option value="ALL">All</option>
                                                <option value="PENDING">Pending</option>
                                                <option value="APPROVED">Approved</option>
                                                <option value="REJECTED">Rejected</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-8">
                                        {tsLoading ? (
                                            <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-[32px] border border-brand-blue/5 shadow-sm">
                                                <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                                                <p className="text-brand-blue/40 font-bold uppercase tracking-widest text-[10px]">Filtering Team Evidence...</p>
                                            </div>
                                        ) : groupedWeeks.length === 0 ? (
                                            <div className="py-20 text-center bg-white rounded-[32px] border-2 border-dashed border-brand-blue/5">
                                                <p className="text-brand-blue/20 font-bold uppercase tracking-widest text-xs italic">No team timesheet records found.</p>
                                            </div>
                                        ) : (
                                            groupedWeeks.map(week => {
                                                const filteredEmployees = week.employeeList.filter(emp => {
                                                    if (tsStatusFilter !== "ALL" && (emp.status || "").toUpperCase() !== tsStatusFilter) return false;
                                                    if (!tsFilter) return true;
                                                    const member = teamMembers.find(m => m.id === emp.employeeId);
                                                    const displayId = (member?.oryfolksId || emp.employeeId || "").toString().toLowerCase();
                                                    return emp.employeeName.toLowerCase().includes(tsFilter.toLowerCase()) || displayId.includes(tsFilter.toLowerCase());
                                                });
                                                return { ...week, filteredEmployees };
                                            }).filter(week => week.filteredEmployees.length > 0).map((week, wIdx) => (
                                                <div key={wIdx} className="bg-white rounded-[32px] shadow-xl border border-brand-blue/5 overflow-hidden">
                                                    <div className="bg-white p-3 px-6 flex items-center justify-between border-b border-brand-blue/5">
                                                        <div>
                                                            <h3 className="text-brand-blue font-black text-sm uppercase">Week of {week.startDateStr}</h3>
                                                            <p className="text-brand-blue/40 text-[9px] font-bold uppercase tracking-widestLeading-none">{week.startDateStr} — {week.endDateStr}</p>
                                                        </div>
                                                        <div className="bg-brand-blue/5 px-3 py-1 rounded-lg border border-brand-blue/10">
                                                            <span className="text-brand-blue font-black text-xs">{week.filteredEmployees.length}</span>
                                                            <span className="text-brand-blue/40 text-[8px] font-bold uppercase tracking-widest ml-2">Team Members Recorded</span>
                                                        </div>
                                                    </div>
                                                    <div className="p-4 grid grid-cols-1 gap-2">
                                                        {week.filteredEmployees.map((emp, eIdx) => {
                                                            const isDisabled = emp.employeeStatus === 'INACTIVE' || emp.employeeStatus === 'DISABLED';
                                                            return (
                                                            <div key={eIdx} onClick={() => { setSelectedWeek({ ...week, entries: emp.entries, status: emp.status, employeeId: emp.employeeId, employeeName: emp.employeeName, employeeStatus: emp.employeeStatus, startDate: week.startDateStr, endDate: week.endDateStr }); setTsSubView('grid'); }} className={`group p-4 rounded-2xl flex items-center gap-4 border border-transparent transition-all cursor-pointer ${isDisabled ? 'bg-[#F1EFE8]' : 'bg-bg-slate/30 hover:bg-white hover:border-brand-blue/10 hover:shadow-xl'}`}>
                                                                <div className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black transition-all shadow-sm ${isDisabled ? 'text-brand-blue/20' : 'text-brand-blue/30 group-hover:bg-brand-blue group-hover:text-white'}`}>{emp.employeeName?.[0]}</div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className={`font-black text-sm uppercase tracking-tight ${isDisabled ? 'text-brand-blue/40' : 'text-brand-blue'}`}>{emp.employeeName}</h4>
                                                                        <span className="text-[10px] font-bold text-brand-blue/20 uppercase tracking-widest">ID: {(() => {
                                                                            const member = teamMembers.find(m => m.id === emp.employeeId);
                                                                            return member?.oryfolksId || emp.employeeId;
                                                                        })()}</span>
                                                                        {isDisabled && (
                                                                            <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px]">DISABLED ACCOUNT</span>
                                                                        )}
                                                                    </div>
                                                                    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase inline-block mt-1 ${emp.status === 'Approved' ? 'bg-emerald-100 text-emerald-600' : emp.status === 'Rejected' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>{emp.status}</div>
                                                                </div>
                                                                <div className={`hidden md:flex items-center gap-6 pr-6 ${isDisabled ? 'opacity-60 grayscale' : ''}`}>
                                                                    <div className="text-center"><p className="text-xs font-black text-brand-blue">{emp.billableHrs.toFixed(1)}</p><p className="text-[8px] font-black text-brand-blue/20 uppercase tracking-widest">Billable</p></div>
                                                                    <div className="text-center"><p className="text-xs font-black text-brand-blue">{emp.nonBillableHrs.toFixed(1)}</p><p className="text-[8px] font-black text-brand-blue/20 uppercase tracking-widest">Non-Bill</p></div>
                                                                    <div className="text-center border-l border-brand-blue/5 pl-6"><p className="text-sm font-black text-indigo-600">{(emp.billableHrs + emp.nonBillableHrs + emp.timeOffHrs).toFixed(1)}</p><p className="text-[8px] font-black text-indigo-600/30 uppercase tracking-widest">Total</p></div>
                                                                </div>
                                                                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-brand-blue/20 group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></div>
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
                                    <WeeklyTimesheetGrid weekData={selectedWeek} employeeId={selectedWeek.employeeId} readOnly={true} approvedLeaves={[]} disabledAccount={selectedWeek?.employeeStatus === 'INACTIVE' || selectedWeek?.employeeStatus === 'DISABLED'} onBack={() => setTsSubView('summary')} onApprove={() => handleApproveWeek(selectedWeek)} onReject={() => handleRejectWeek(selectedWeek)} />
                                </div>
                            )}
                        </div>
                    )}
                    {view === 'leaves' && (
                        <div className="max-w-[1200px] mx-auto">
                            <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-4 mb-8">
                                <input type="text" placeholder="Filter by name..." value={leavesFilter} onChange={(e) => setLeavesFilter(e.target.value)} className="w-full sm:w-[268px] h-[47px] bg-white border-2 border-transparent focus:border-brand-yellow rounded-2xl px-5 text-sm font-bold text-brand-blue outline-none transition-all shadow-sm" />
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue/40">Status</span>
                                    <select
                                        value={leaveStatusFilter}
                                        onChange={(e) => setLeaveStatusFilter(e.target.value)}
                                        className="px-3 py-2 bg-white border border-brand-blue/10 rounded-xl text-[11px] font-bold text-brand-blue outline-none focus:border-brand-blue/30 transition-all cursor-pointer shadow-sm"
                                    >
                                        <option value="ALL">All</option>
                                        <option value="PENDING">Pending</option>
                                        <option value="APPROVED">Approved</option>
                                        <option value="REJECTED">Rejected</option>
                                    </select>
                                </div>
                            </div>
                            <div className="bg-white rounded-[20px] shadow-xl overflow-hidden border border-brand-blue/5">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead className="sticky top-0 z-20 bg-white">
                                            <tr className="bg-brand-blue/[0.02]">
                                                <th className="py-3 px-4 text-[11px] font-black uppercase tracking-[0.15em] text-brand-blue/40 border-b border-brand-blue/5 w-20">Emp ID</th>
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-blue/40 border-b border-brand-blue/5">Requester</th>
                                                <th className="py-3 px-4 text-[11px] font-black uppercase tracking-[0.15em] text-brand-blue/40 border-b border-brand-blue/5">Category</th>
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-blue/40 border-b border-brand-blue/5 text-center min-w-[200px]">Duration</th>
                                                <th className="py-3 px-5 text-[11px] font-black uppercase tracking-[0.15em] text-brand-blue/40 border-b border-brand-blue/5 text-center">Status</th>
                                                <th className="py-3 px-6 text-[11px] font-black uppercase tracking-[0.15em] text-brand-blue/40 border-b border-brand-blue/5 text-right">Decision Control</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-brand-blue/5">
                                            {leavesLoading ? (<tr><td colSpan="6" className="py-20 text-center animate-pulse">Loading Team Leaves...</td></tr>) : leavesError ? (<tr><td colSpan="6" className="py-20 text-center text-red-500">{leavesError}</td></tr>) : leaves.length === 0 ? (<tr><td colSpan="6" className="py-20 text-center italic">No leave requests found.</td></tr>) : (
                                                leaves.filter(lv => (!leavesFilter || lv.employeeName.toLowerCase().includes(leavesFilter.toLowerCase())) && (leaveStatusFilter === "ALL" || (lv.status || "").toUpperCase() === leaveStatusFilter)).map((leave) => {
                                                    const isDisabled = leave.employeeStatus === 'INACTIVE' || leave.employeeStatus === 'DISABLED';
                                                    return (
                                                    <tr key={leave.id} className={`group transition-all duration-300 ${isDisabled ? 'bg-[#F1EFE8]' : 'hover:bg-bg-slate/40'}`}>
                                                        <td className="py-3 px-4">
                                                            <span className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest">{leave.oryfolksId || leave.employeeId}</span>
                                                        </td>
                                                        <td className="py-3 px-6">
                                                            <div className="flex items-center gap-2">
                                                                <span className={`text-sm font-black tracking-tight uppercase ${isDisabled ? 'text-brand-blue/40' : 'text-brand-blue'}`}>{leave.employeeName}</span>
                                                                {isDisabled && (
                                                                    <span className="inline-flex px-2 py-0.5 bg-[#D3D1C7] text-[#5F5E5A] text-[10px] font-medium rounded-[4px] normal-case tracking-normal">DISABLED ACCOUNT</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-6">
                                                            <span className="px-3 py-1 bg-brand-blue/5 text-brand-blue text-[8px] font-black uppercase tracking-widest rounded-lg border border-brand-blue/10">
                                                                {leave.leaveType}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-6 text-center">
                                                            <div className="flex flex-col items-center">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[10px] font-black text-brand-blue">{formatDate(leave.startDate)}</span>
                                                                    <span className="text-[8px] font-black text-brand-blue/10 font-bold">to</span>
                                                                    <span className="text-[10px] font-black text-brand-blue">{formatDate(leave.endDate)}</span>
                                                                </div>
                                                                <span className="mt-1 px-2 py-0.5 bg-brand-yellow text-brand-blue text-[8px] font-black rounded-md">
                                                                    {(leave.daysCount != null ? leave.daysCount.toFixed(1) : calculateLeaveDays(leave.startDate, leave.endDate))} Days
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-6 text-center">
                                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${leave.status === 'PENDING'
                                                                ? 'bg-brand-yellow/10 text-brand-yellow-dark border-brand-yellow/20'
                                                                : leave.status === 'APPROVED'
                                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                    : 'bg-red-50 text-red-600 border-red-100'
                                                                }`}>
                                                                {leave.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-8 text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedLeave(leave);
                                                                        setIsDetailsModalOpen(true);
                                                                    }}
                                                                    className="p-2 bg-brand-blue/5 text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white transition-all shadow-sm"
                                                                    title="View Details"
                                                                    aria-label="View Details"
                                                                >
                                                                    <Eye size={16} />
                                                                </button>
                                                                {leave.status === 'PENDING' && !isDisabled && (
                                                                    <LeaveDecisionButtons
                                                                        onApprove={() => handleApproveLeave(leave.id)}
                                                                        onReject={() => handleRejectLeave(leave.id)}
                                                                        processing={processingId === leave.id}
                                                                    />
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>
            <LeaveDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => setIsDetailsModalOpen(false)}
                leave={selectedLeave}
            />
        </div>
    );
}
