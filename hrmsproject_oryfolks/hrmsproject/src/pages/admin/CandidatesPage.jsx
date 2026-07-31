import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AdminSidebar from "../../components/AdminSidebar";
import { useNavigate } from "react-router-dom";
import useEmployees from "../../hooks/useEmployees";
import api from "../../utils/api";
import DisabledBadge from "../../components/DisabledBadge";

export default function CandidatesPage() {
  const { employees, loading, error, refresh } = useEmployees();
  const [localEmployees, setLocalEmployees] = useState([]);
  const [assignmentsMap, setAssignmentsMap] = useState({});
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState({});
  // 3-dot options menu: { id, rect } of the currently open employee row
  const [openMenu, setOpenMenu] = useState(null);
  // Confirmation popup: { type: 'disable' | 'enable' | 'delete', emp }
  const [confirmModal, setConfirmModal] = useState(null);
  // Blocking modal shown when disable/delete is prevented by pending approvals:
  // { type: 'disable' | 'delete', timesheets, leaves }
  const [pendingBlock, setPendingBlock] = useState(null);
  const [roleFilter, setRoleFilter] = useState("All");
  const [idSort, setIdSort] = useState("");
  const [nameSort, setNameSort] = useState("");
  const [editingHrEmployeeId, setEditingHrEmployeeId] = useState(null);
  const [tempHrId, setTempHrId] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setUser(userData);
  }, []);

  useEffect(() => {
    setLocalEmployees(employees || []);
  }, [employees]);

  const fetchAssignments = async () => {
    setAssignmentsLoading(true);
    try {
      const res = await api("/api/reporting-managers/assignments");
      if (res.ok) {
        const list = await res.json();
        const map = {};
        (list || []).forEach((it) => {
          if (it && it.employeeId) {
            map[it.employeeId] = {
              managerId: it.reportingManagerId || null,
              managerName: it.reportingManagerName || null,
              managerEmail: it.reportingManagerEmail || null,
              managerRole: it.reportingManagerRole || null,
              hrId: it.hrId || null,
              hrName: it.hrName || null,
              hrRole: it.hrRole || null,
            };
          }
        });
        setAssignmentsMap(map);
      }
    } catch (e) {
      console.error("Failed to load assignments", e);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredEmployees = (localEmployees || []).filter((emp) => {
    const fullName = `${emp.firstName || ""} ${emp.lastName || ""}`.toLowerCase();
    const email = (emp.email || "").toLowerCase();
    const id = emp.id ? String(emp.id) : "";
    const oryfolksId = emp.oryfolksId ? String(emp.oryfolksId).toLowerCase() : "";
    const corporateEmail = (emp.corporateEmail || "").toLowerCase();
    const term = searchTerm.toLowerCase();
    const isSystemAdmin = (emp.role === 'ADMIN') || (emp.firstName === 'System' && emp.lastName === 'Admin');
    if (isSystemAdmin) return false;

    // Role filter check
    if (roleFilter !== "All") {
      const empRole = (emp.role || "").toUpperCase();
      const filterRole = roleFilter.toUpperCase();
      if (empRole !== filterRole) return false;
    }

    return (
      id.includes(term) ||
      oryfolksId.includes(term) ||
      fullName.includes(term) ||
      email.includes(term) ||
      corporateEmail.includes(term)
    );
  });

  const processedEmployees = [...filteredEmployees].sort((a, b) => {
    if (idSort) {
      if (idSort === "low-to-high") {
        const idA = a.oryfolksId || "";
        const idB = b.oryfolksId || "";
        return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
      } else if (idSort === "high-to-low") {
        const idA = a.oryfolksId || "";
        const idB = b.oryfolksId || "";
        return idB.localeCompare(idA, undefined, { numeric: true, sensitivity: 'base' });
      } else if (idSort === "newest") {
        const dateA = a.joiningDate ? new Date(a.joiningDate) : new Date(0);
        const dateB = b.joiningDate ? new Date(b.joiningDate) : new Date(0);
        if (dateA.getTime() === dateB.getTime()) {
          return b.id - a.id;
        }
        return dateB - dateA;
      } else if (idSort === "oldest") {
        const dateA = a.joiningDate ? new Date(a.joiningDate) : new Date(9999, 11, 31);
        const dateB = b.joiningDate ? new Date(b.joiningDate) : new Date(9999, 11, 31);
        if (dateA.getTime() === dateB.getTime()) {
          return a.id - b.id;
        }
        return dateA - dateB;
      }
    }

    if (nameSort) {
      const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim().toLowerCase();
      const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim().toLowerCase();
      if (nameSort === "a-z") {
        return nameA.localeCompare(nameB);
      } else if (nameSort === "z-a") {
        return nameB.localeCompare(nameA);
      }
    }

    return 0;
  });

  const adminUser = (localEmployees || []).find((emp) => emp.role === 'ADMIN') || (user && user.role === 'ADMIN' ? user : null);
  const adminName = adminUser ? (adminUser.lastName?.toLowerCase() === 'admin' ? adminUser.firstName : `${adminUser.firstName} ${adminUser.lastName}`) : 'Admin';
  const activeHRs = (localEmployees || []).filter(e => e.role === 'HR' && e.active !== false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const closeMenu = () => setOpenMenu(null);

  // Close the 3-dot menu on Escape (outside-click is handled by the overlay in the portal below).
  useEffect(() => {
    if (!openMenu) return;
    const onKeyDown = (e) => { if (e.key === "Escape") setOpenMenu(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openMenu]);

  const toggleMenu = (empId, e) => {
    e && e.stopPropagation();
    if (openMenu && openMenu.id === empId) {
      setOpenMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setOpenMenu({ id: empId, rect });
  };

  const handleViewProfile = (emp) => {
    if (window.confirm("Are you sure you want to view this employee's profile?")) {
      navigate(`/admin/employee/${emp.id}`, { state: emp });
    }
  };

  const handleStatusChange = async (emp, active) => {
    try {
      const res = await api(`/api/employees/${emp.id}/status`, {
        method: "PUT",
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to update status");
      }
      setLocalEmployees((prev) =>
        prev.map((p) => (p.id === emp.id ? { ...p, active } : p))
      );
      refresh();
      showToast(
        active ? "Employee enabled successfully" : "Employee disabled successfully",
        "success"
      );
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to update status", "error");
    }
  };

  const handleDelete = async (empId) => {
    try {
      const res = await api(`/api/employees/${empId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Failed to delete");
      }
      setLocalEmployees((prev) => prev.filter((p) => p.id !== empId));
      refresh();
      showToast("Employee deleted successfully", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to delete employee", "error");
    }
  };

  const handleSaveHrUpdate = async (employeeId, hrId) => {
    if (!window.confirm("Are you sure you want to change the HR Liaison for this employee?")) {
      return;
    }
    const currentManagerId = assignmentsMap[employeeId]?.managerId || null;
    try {
      const res = await api("/api/reporting-managers", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          reportingManagerId: currentManagerId,
          hrId: hrId ? parseInt(hrId) : null
        })
      });
      if (!res.ok) {
        throw new Error("Failed to update HR liaison");
      }
      await fetchAssignments();
      setEditingHrEmployeeId(null);
      showToast("HR Liaison updated successfully", "success");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to update HR Liaison", "error");
    }
  };

  // Before disabling or deleting, check the backend for pending timesheets/leaves.
  // If any exist, show a blocking modal instead of the confirmation dialog. The
  // backend enforces this too; this pre-check is only for immediate, clearer UX.
  const requestDestructiveAction = async (type, emp) => {
    if (emp.role === 'HR' && (type === 'disable' || type === 'delete')) {
      const assignedNames = Object.entries(assignmentsMap)
        .filter(([empId, assign]) => String(assign.hrId) === String(emp.id))
        .map(([empId]) => {
          const e = localEmployees.find(x => String(x.id) === String(empId));
          return e ? `${e.firstName || ""} ${e.lastName || ""} (${e.role || "Personnel"})` : null;
        })
        .filter(Boolean);

      if (assignedNames.length > 0) {
        alert(`Cannot ${type} this HR account. The following employees/reporting managers are assigned to this HR Liaison:\n\n` +
          assignedNames.map((name, idx) => `${idx + 1}. ${name}`).join("\n") +
          `\n\nPlease reassign these employees to another active HR Liaison first.`);
        return;
      }
    }

    try {
      const res = await api(`/api/employees/${emp.id}/pending-check`);
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        const summary = body?.data || {};
        if (summary.hasPending) {
          setPendingBlock({
            type,
            timesheets: summary.pendingTimesheets || 0,
            leaves: summary.pendingLeaves || 0,
          });
          return;
        }
      }
      // If the check itself failed, fall through to the confirmation dialog —
      // the backend will still block the action if pending items exist.
    } catch (err) {
      console.error("Pending-approval check failed", err);
    }
    setConfirmModal({ type, emp });
  };

  // Execute the action confirmed in the popup
  const runConfirm = () => {
    if (!confirmModal) return;
    const { type, emp } = confirmModal;
    if (type === "disable") handleStatusChange(emp, false);
    else if (type === "enable") handleStatusChange(emp, true);
    else if (type === "delete") handleDelete(emp.id);
    setConfirmModal(null);
  };

  // Copy for the confirmation popup, keyed by action type
  const confirmCopy = {
    disable: {
      title: "Disable Employee",
      message: "Are you sure you want to disable this employee?",
      confirmLabel: "Confirm",
      confirmClass: "bg-amber-500 hover:bg-amber-600",
    },
    enable: {
      title: "Enable Employee",
      message: "Are you sure you want to enable this employee?",
      confirmLabel: "Confirm",
      confirmClass: "bg-emerald-500 hover:bg-emerald-600",
    },
    delete: {
      title: "Delete Employee",
      message:
        "Are you sure you want to permanently delete this employee? This action cannot be undone.",
      confirmLabel: "Delete",
      confirmClass: "bg-red-500 hover:bg-red-600",
    },
  };

  return (
    <div className="flex h-screen w-screen bg-[#e3edf9] flex-col md:flex-row overflow-hidden font-brand text-brand-blue">
      {/* Sidebar */}
      <AdminSidebar
        activeTab="candidates"
        setActiveTab={() => { }}
        onLogout={handleLogout}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Premium Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-brand-blue/5">
          <div className="flex items-center gap-6">
            <div className="w-11 h-11 bg-brand-blue/5 rounded-xl flex items-center justify-center border border-brand-blue/10 shadow-sm overflow-hidden text-sm font-black text-brand-blue">
              {user.photoPath ? (
                <img src={user.photoPath} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                (user.firstName?.[0] || user.fullName?.[0]) || "A"
              )}
            </div>
            <div>
              <h1 className="text-xl font-black text-brand-blue tracking-tight">Employee Directory</h1>
              <p className="text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
                Resource Infrastructure Audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/admin")}
              className="p-2.5 bg-brand-blue/5 hover:bg-brand-blue text-brand-blue hover:text-white rounded-xl border border-brand-blue/10 transition-all duration-200 shadow-sm active:scale-95 group"
              title="Go to Dashboard"
            >
              <svg className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </button>
          </div>
        </header>

        <div className="flex-1 p-3 md:p-6 space-y-4 flex flex-col overflow-hidden">
          {/* Table Container */}
          <div className="bg-white rounded-[32px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex flex-col flex-1">
            <div className="px-6 py-3.5 border-b border-brand-blue/5 flex items-center justify-between bg-bg-slate/30">
              <div>
                <h2 className="text-xl font-black text-brand-blue tracking-tight">Employee Registry</h2>

              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-white border border-brand-blue/10 rounded-2xl px-4 py-1.5 w-64 focus-within:w-72 transition-all duration-300 shadow-sm">
                  <svg className="w-4 h-4 text-brand-blue/30 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    className="bg-transparent border-none outline-none text-xs text-brand-blue placeholder-brand-blue/40 w-full font-bold"
                    placeholder="Search resources..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
                <span className="bg-brand-blue/5 text-brand-blue px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {processedEmployees.length} Total Records
                </span>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-scroll flex-1 list-scrollbar">
              {loading || assignmentsLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-30">
                  <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Synchronizing Database...</p>
                </div>
              ) : error ? (
                <div className="py-20 text-center">
                  <p className="text-red-500 font-bold">{error}</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse border-spacing-0">
                  <thead>
                    <tr className="bg-brand-blue/[0.02]">
                      <th className="sticky top-0 bg-white z-10 py-3 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>EMP ID</span>
                          <div className="relative inline-flex items-center">
                            <select
                              value={idSort}
                              onChange={(e) => {
                                setIdSort(e.target.value);
                                setNameSort("");
                              }}
                              className="appearance-none bg-white border border-brand-blue/10 rounded-md px-2 py-0.5 pr-5 text-[9px] font-bold text-brand-blue/60 hover:text-brand-blue outline-none cursor-pointer focus:ring-1 focus:ring-brand-blue/10 transition-all"
                            >
                              <option value="" className="bg-white text-brand-blue text-xs normal-case font-semibold">Default</option>
                              <option value="low-to-high" className="bg-white text-brand-blue text-xs normal-case font-semibold">ID: Low-High</option>
                              <option value="high-to-low" className="bg-white text-brand-blue text-xs normal-case font-semibold">ID: High-Low</option>
                              <option value="newest" className="bg-white text-brand-blue text-xs normal-case font-semibold">Newest</option>
                              <option value="oldest" className="bg-white text-brand-blue text-xs normal-case font-semibold">Oldest</option>
                            </select>
                            <svg className={`w-2 h-2 absolute right-1.5 pointer-events-none transition-colors ${idSort ? 'text-brand-yellow stroke-[5]' : 'text-brand-blue/30'}`} fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>Member Identity</span>
                          <div className="relative inline-flex items-center">
                            <select
                              value={nameSort}
                              onChange={(e) => {
                                setNameSort(e.target.value);
                                setIdSort("");
                              }}
                              className="appearance-none bg-white border border-brand-blue/10 rounded-md px-2 py-0.5 pr-5 text-[9px] font-bold text-brand-blue/60 hover:text-brand-blue outline-none cursor-pointer focus:ring-1 focus:ring-brand-blue/10 transition-all"
                            >
                              <option value="" className="bg-white text-brand-blue text-xs normal-case font-semibold">Default</option>
                              <option value="a-z" className="bg-white text-brand-blue text-xs normal-case font-semibold">A-Z</option>
                              <option value="z-a" className="bg-white text-brand-blue text-xs normal-case font-semibold">Z-A</option>
                            </select>
                            <svg className={`w-2 h-2 absolute right-1.5 pointer-events-none transition-colors ${nameSort ? 'text-brand-yellow stroke-[5]' : 'text-brand-blue/30'}`} fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>Professional Role</span>
                          <div className="relative inline-flex items-center">
                            <select
                              value={roleFilter}
                              onChange={(e) => setRoleFilter(e.target.value)}
                              className="appearance-none bg-white border border-brand-blue/10 rounded-md px-2 py-0.5 pr-5 text-[9px] font-bold text-brand-blue/60 hover:text-brand-blue outline-none cursor-pointer focus:ring-1 focus:ring-brand-blue/10 transition-all"
                            >
                              <option value="All" className="bg-white text-brand-blue text-xs normal-case font-semibold">All</option>
                              <option value="EMPLOYEE" className="bg-white text-brand-blue text-xs normal-case font-semibold">Employee</option>
                              <option value="HR" className="bg-white text-brand-blue text-xs normal-case font-semibold">HR</option>
                              <option value="REPORTING_MANAGER" className="bg-white text-brand-blue text-xs normal-case font-semibold">Reporting Manager</option>
                            </select>
                            <svg className={`w-2 h-2 absolute right-1.5 pointer-events-none transition-colors ${roleFilter !== 'All' ? 'text-brand-yellow stroke-[5]' : 'text-brand-blue/30'}`} fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>Hierarchy Lead</span>
                          <div className="h-5" />
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>HR Liaison</span>
                          <div className="h-5" />
                        </div>
                      </th>
                      {/* <th className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">Communication</th> */}
                      <th className="sticky top-0 bg-white z-10 py-3 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span>Action</span>
                          <div className="h-5" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-blue/5">
                    {processedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center italic text-brand-blue/20 font-bold uppercase tracking-widest text-xs">
                          No matching personnel found in directory
                        </td>
                      </tr>
                    ) : (
                      processedEmployees.map((emp) => {
                        const isInactive = emp.active === false;
                        return (
                          <tr
                            key={emp.id}
                            className={`group transition-all cursor-pointer ${isInactive ? "bg-gray-100 opacity-60 grayscale hover:opacity-80" : "hover:bg-bg-slate/50"}`}
                            onClick={() => handleViewProfile(emp)}
                          >
                            <td className="py-5 px-8">
                              <span className="text-xs font-black text-brand-blue/30 group-hover:text-brand-blue transition-colors">
                                {emp.oryfolksId || "PENDING"}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-brand-blue/5 rounded-xl flex items-center justify-center text-[11px] font-black text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                  {(emp.firstName?.[0] || "U")}
                                </div>
                                <span className="text-sm font-bold text-brand-blue tracking-tight">
                                  {`${emp.firstName || ""} ${emp.lastName || ""}`}
                                </span>
                                {isInactive && <DisabledBadge />}
                              </div>
                            </td>
                            <td className="py-5 px-6">
                              <span className="inline-flex px-3 py-1 bg-brand-yellow/10 text-brand-blue text-[9px] font-black uppercase tracking-widest rounded-full border border-brand-yellow/20">
                                {emp.role || 'Personnel'}
                              </span>
                            </td>
                            <td className="py-5 px-6">
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-brand-blue/60 tabular-nums uppercase tracking-tight">
                                  {emp.role === 'HR' ? adminName :
                                    emp.role === 'REPORTING_MANAGER' ? (assignmentsMap[emp.id]?.hrName || 'HR Coordinator') :
                                      (assignmentsMap[emp.id]?.managerName || 'Unassigned')}
                                </span>
                                <span className="text-[9px] font-bold text-brand-blue/20 uppercase tracking-widest">Structural Lead</span>
                              </div>
                            </td>
                            <td className="py-5 px-6">
                              {emp.role === 'HR' ? (
                                <span className="text-xs font-bold text-brand-blue/60 tabular-nums">
                                  {adminName}
                                </span>
                              ) : editingHrEmployeeId === emp.id ? (
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <select
                                    value={tempHrId || ""}
                                    onChange={(e) => setTempHrId(e.target.value)}
                                    className="text-xs font-bold text-brand-blue bg-white border border-brand-blue/20 rounded-lg px-2 py-1 outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/10 max-w-[130px]"
                                  >
                                    <option value="">Unassigned</option>
                                    {activeHRs.map(hr => (
                                      <option key={hr.id} value={hr.id}>{`${hr.firstName || ""} ${hr.lastName || ""}`}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => handleSaveHrUpdate(emp.id, tempHrId)}
                                    className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 transition shadow-sm flex items-center justify-center"
                                    title="Save"
                                    aria-label="Save"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setEditingHrEmployeeId(null)}
                                    className="p-1 rounded bg-red-500 text-white hover:bg-red-600 transition shadow-sm flex items-center justify-center"
                                    title="Cancel"
                                    aria-label="Cancel"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group/edit">
                                  <span className="text-xs font-bold text-brand-blue/60 tabular-nums">
                                    {assignmentsMap[emp.id]?.hrName || '–'}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingHrEmployeeId(emp.id);
                                      setTempHrId(assignmentsMap[emp.id]?.hrId || "");
                                    }}
                                    className="p-1 rounded-lg bg-brand-blue/5 text-brand-blue hover:bg-brand-blue hover:text-white transition-all shadow-sm flex items-center justify-center"
                                    title="Edit HR Liaison"
                                    aria-label="Edit HR Liaison"
                                  >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </td>
                            {/* <td className="py-5 px-6">
                            <span className="text-xs font-bold text-brand-blue/40 group-hover:text-brand-blue/70 transition-colors tabular-nums underline decoration-brand-blue/5 decoration-2 underline-offset-4">
                              {emp.corporateEmail || "Await Provision"}
                            </span>
                          </td> */}
                            <td className="py-5 px-8 text-center">
                              <button
                                onClick={(e) => toggleMenu(emp.id, e)}
                                className={`p-2.5 rounded-xl transition-all shadow-sm ${openMenu && openMenu.id === emp.id ? "bg-brand-blue text-white" : "bg-brand-blue/5 text-brand-blue hover:bg-brand-blue hover:text-white"}`}
                                title="Options"
                                aria-label="Options"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="5" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="12" cy="19" r="2" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
      </main>

      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest animate-in slide-in-from-right duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
          {toast.message}
        </div>
      )}

      {/* 3-dot options menu (portal so it is never clipped by the scroll container) */}
      {openMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[140]" onClick={closeMenu} />
          {(() => {
            const emp = localEmployees.find((e) => e.id === openMenu.id);
            if (!emp) return null;
            const isInactive = emp.active === false;
            const left = Math.max(8, openMenu.rect.right - 192);
            // Flip the menu upward when there isn't enough room below the button (e.g. the
            // last row near the bottom of the page) so the dropdown is never clipped.
            const menuHeight = (isInactive ? 3 : 2) * 44 + 24; // items + padding/divider
            const spaceBelow = window.innerHeight - openMenu.rect.bottom;
            const openUpward = spaceBelow < menuHeight + 8;
            const positionStyle = openUpward
              ? { bottom: window.innerHeight - openMenu.rect.top + 6, left }
              : { top: openMenu.rect.bottom + 6, left };
            return (
              <div
                className={`fixed z-[150] w-48 bg-white rounded-2xl shadow-2xl border border-brand-blue/10 py-2 animate-in fade-in zoom-in duration-150 ${openUpward ? 'origin-bottom-right' : 'origin-top-right'}`}
                style={positionStyle}
              >
                {isInactive ? (
                  <>
                    <button
                      onClick={() => { closeMenu(); setConfirmModal({ type: "enable", emp }); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-emerald-600 hover:bg-emerald-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Enable
                    </button>
                    <button
                      onClick={() => { closeMenu(); handleViewProfile(emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-brand-blue hover:bg-bg-slate transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      View Profile
                    </button>
                    <div className="h-px bg-brand-blue/5 mx-2 my-1" />
                    <button
                      onClick={() => { closeMenu(); requestDestructiveAction("delete", emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => { closeMenu(); requestDestructiveAction("disable", emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-amber-600 hover:bg-amber-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      Disable
                    </button>
                    <div className="h-px bg-brand-blue/5 mx-2 my-1" />
                    <button
                      onClick={() => { closeMenu(); requestDestructiveAction("delete", emp); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Delete
                    </button>
                  </>
                )}
              </div>
            );
          })()}
        </>,
        document.body
      )}

      {/* Confirmation popup */}
      {confirmModal && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={() => setConfirmModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-black mb-3 text-brand-blue uppercase tracking-tight">
              {confirmCopy[confirmModal.type].title}
            </h3>
            <p className="text-sm font-bold text-brand-blue/60 mb-6 leading-relaxed">
              {confirmCopy[confirmModal.type].message}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 bg-slate-100 text-slate-600 px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={runConfirm}
                className={`flex-1 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-lg ${confirmCopy[confirmModal.type].confirmClass}`}
              >
                {confirmCopy[confirmModal.type].confirmLabel}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Blocking modal — disable/delete prevented by pending approvals */}
      {pendingBlock && createPortal(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4" onClick={() => setPendingBlock(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border-t-4 border-amber-500" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-2.99L13.74 4a2 2 0 00-3.48 0L3.33 16.01A2 2 0 005.07 19z" /></svg>
              </div>
              <h3 className="text-lg font-black text-brand-blue uppercase tracking-tight">
                Cannot {pendingBlock.type === "delete" ? "Delete" : "Disable"} Account
              </h3>
            </div>
            <p className="text-sm font-bold text-brand-blue/70 mb-3 leading-relaxed">
              This employee has pending approvals that must be resolved first:
            </p>
            <ul className="text-sm font-bold text-brand-blue/80 mb-4 space-y-1 list-disc list-inside">
              <li>{pendingBlock.timesheets} pending timesheet(s)</li>
              <li>{pendingBlock.leaves} pending leave(s)</li>
            </ul>
            <p className="text-xs font-bold text-brand-blue/50 mb-6 leading-relaxed">
              Please ensure all timesheets and leaves are approved or rejected before {pendingBlock.type === "delete" ? "deleting" : "disabling"} this account.
            </p>
            <button
              onClick={() => setPendingBlock(null)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-lg"
            >
              OK
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
