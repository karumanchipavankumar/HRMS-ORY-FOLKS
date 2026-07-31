import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import { getHrNavItems } from "../../utils/hrNav";
import LeaveDetailsModal from "../../components/LeaveDetailsModal";
import LeaveDecisionButtons from "../../components/LeaveDecisionButtons";
import { Eye } from "lucide-react";
import NotificationComponent from "../../components/NotificationComponent";
import { toast } from "react-toastify";
import api from "../../utils/api";

export default function HrManagerLeaves() {
    const [activeTab, setActiveTab] = useState("leaves");
    const [user, setUser] = useState({});
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [leaves, setLeaves] = useState([]);
    const [leavesFilter, setLeavesFilter] = useState("");
    const [employees, setEmployees] = useState([]);
    const [leaveRoleFilter, setLeaveRoleFilter] = useState("ALL");
    const [leaveStatusFilter, setLeaveStatusFilter] = useState("ALL");
    const [selectedLeave, setSelectedLeave] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    // Id of the leave whose decision is currently being submitted (one-time / dup guard)
    const [processingId, setProcessingId] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem("user")) || {};
        setUser(userData);
        loadAllData();

        const handleClickOutside = (event) => {
            if (!event.target.closest("#profile-dropdown-container")) {
                setIsProfileDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        const emps = await fetchEmployees();
        await fetchData(emps);
        setLoading(false);
    };

    const fetchEmployees = async () => {
        try {
            const res = await api("/api/employees");
            const data = await res.json();
            const emps = Array.isArray(data.data) ? data.data : [];
            setEmployees(emps);
            return emps;
        } catch (error) {
            console.error("Error fetching employees:", error);
            return [];
        }
    };

    const fetchData = async (empsList) => {
        try {
            const currentEmps = empsList || employees;
            const res = await api("/api/leaves");

            if (res.ok) {
                const json = await res.json();
                let allLeaves = json.data || json || [];

                // Filter out HR leaves immediately
                const filteredLeaves = allLeaves.filter(lv => {
                    const emp = currentEmps.find(e => e.id === lv.employeeId || e.fullName === lv.employeeName);
                    return emp?.role !== "HR";
                });

                // Sort: pending on top, then by date desc
                filteredLeaves.sort((a, b) => {
                    if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
                    if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
                    const dateA = new Date(a.startDate);
                    const dateB = new Date(b.startDate);
                    return dateB - dateA;
                });

                setLeaves(filteredLeaves);
            }
        } catch (err) {
            console.error("Error fetching data", err);
        }
    };

    const handleLogout = () => {
        if (window.confirm("Are you sure you want to logout?")) {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            navigate("/login");
        }
    };

    const handleApprove = async (leaveId) => {
        if (!window.confirm("check all leaves and timesheets before approving")) {
            return;
        }
        // One-time enforcement: block if a decision submission is already in flight
        if (processingId) return;
        setProcessingId(leaveId);
        try {
            const res = await api(`/api/leaves/${leaveId}/approve`, {
                method: 'POST',
                // current user (HR) approves it
                body: JSON.stringify({ approverId: user.id })
            });
            if (res.ok) {
                toast.success("Leave approved successfully.");
                await fetchData();
            } else {
                toast.error("Failed to approve leave");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error approving leave");
        } finally {
            setProcessingId(null);
        }
    };

    const handleReject = async (leaveId) => {
        if (processingId) return;
        const reason = window.prompt("Enter rejection reason:");
        if (reason === null) return;
        if (reason.length > 255) {
            toast.error("Rejection reason cannot exceed 255 characters");
            return;
        }
        setProcessingId(leaveId);
        try {
            const res = await api(`/api/leaves/${leaveId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ approverId: user.id, reason })
            });
            if (res.ok) {
                toast.success("Leave rejected successfully.");
                await fetchData();
            } else {
                toast.error("Failed to reject leave");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error rejecting leave");
        } finally {
            setProcessingId(null);
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

    const calculateLeaveDays = (start, end) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 0;

        let days = 0;
        let d = new Date(startDate);
        while (d <= endDate) {
            const day = d.getDay();
            if (day !== 0 && day !== 6) { // Skip Sat/Sun
                days++;
            }
            d.setDate(d.getDate() + 1);
        }
        return days;
    };

    const navItems = getHrNavItems();

    return (
        <div className="flex h-screen bg-bg-slate font-brand text-brand-blue">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleLogout={handleLogout}
                navItems={navItems}
                hideLogout={true}
            />

            <main className="flex-1 flex flex-col overflow-hidden">
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
                                Employee Leaves
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

                <div className="flex-1 overflow-auto p-4 md:p-10">
                    <div className="max-w-[1200px] mx-auto">
                        <header className="flex flex-col xl:flex-row justify-end items-stretch xl:items-center gap-4 mb-8">
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
                            <div className="flex items-center gap-4">
                                <div className="flex bg-bg-slate/50 p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto scrollbar-hide">
                                    {["ALL", "REPORTING_MANAGERS", "OTHERS"].map((role) => (
                                        <button
                                            key={role}
                                            onClick={() => setLeaveRoleFilter(role)}
                                            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${leaveRoleFilter === role
                                                ? "bg-brand-blue text-white shadow-lg active"
                                                : "text-brand-blue/40 hover:text-brand-blue hover:bg-white"
                                                }`}
                                        >
                                            {role === "REPORTING_MANAGERS" ? "REPORTING MANAGERS" : role === "OTHERS" ? "EMPLOYEES" : role}
                                        </button>
                                    ))}
                                </div>
                                <div className="relative group">
                                    <input
                                        type="text"
                                        placeholder="Search by name or EMP ID..."
                                        value={leavesFilter}
                                        onChange={(e) => setLeavesFilter(e.target.value)}
                                        className="w-[268px] h-[47px] bg-white border-2 border-transparent focus:border-brand-yellow rounded-2xl px-5 text-sm font-bold text-brand-blue/60 outline-none transition-all shadow-sm"
                                    />
                                    <button className="absolute right-0 top-0 h-full w-[66px] bg-brand-blue text-white rounded-r-2xl flex items-center justify-center hover:bg-brand-blue-hover transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </header>

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
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="py-20 text-center text-brand-blue/30 font-bold uppercase tracking-widest text-xs animate-pulse">Loading Leave Requests...</td>
                                            </tr>
                                        ) : leaves.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="py-20 text-center text-brand-blue/20 font-bold uppercase tracking-widest text-xs italic">No leave requests found for managers.</td>
                                            </tr>
                                        ) : (
                                            leaves.filter(lv => {
                                                const q = leavesFilter.toLowerCase().trim();
                                                // Match either the employee name or the EMP ID / Company ID (partial, case-insensitive).
                                                const matchesSearch = !q
                                                    || (lv.employeeName && lv.employeeName.toLowerCase().includes(q))
                                                    || String(lv.oryfolksId || lv.employeeId || "").toLowerCase().includes(q);
                                                const matchesStatus = leaveStatusFilter === "ALL" || (lv.status || "").toUpperCase() === leaveStatusFilter;

                                                // Find employee for role check
                                                const emp = employees.find(e => e.id === lv.employeeId || e.fullName === lv.employeeName);
                                                const role = emp?.role;

                                                if (!matchesStatus) return false;
                                                if (leaveRoleFilter === "ALL") return matchesSearch;
                                                if (leaveRoleFilter === "REPORTING_MANAGERS") return matchesSearch && role === "REPORTING_MANAGER";
                                                if (leaveRoleFilter === "OTHERS") return matchesSearch && role !== "REPORTING_MANAGER";

                                                return matchesSearch;
                                            }).map((leave, index) => {
                                                const isDisabled = leave.employeeStatus === 'INACTIVE' || leave.employeeStatus === 'DISABLED';
                                                return (
                                                <tr key={leave.id || index} className={`group transition-all duration-300 ${isDisabled ? 'bg-[#F1EFE8]' : 'hover:bg-bg-slate/40'}`}>
                                                    <td className="py-3 px-4">
                                                        <span className="text-[10px] font-black text-brand-blue/40 uppercase tracking-widest">
                                                            {leave.oryfolksId || leave.employeeId}
                                                        </span>
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
                                                                    onApprove={() => handleApprove(leave.id)}
                                                                    onReject={() => handleReject(leave.id)}
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
