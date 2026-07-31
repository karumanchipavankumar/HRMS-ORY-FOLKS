import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar";
import useEmployees from "../../hooks/useEmployees";
import { getHrNavItems } from "../../utils/hrNav";
import NotificationComponent from "../../components/NotificationComponent";
import api from "../../utils/api";
import DisabledBadge from "../../components/DisabledBadge";

export default function HrCandidatesPage() {
  const { employees, loading, error, refresh } = useEmployees();
  const [localEmployees, setLocalEmployees] = useState([]);
  const [assignmentsMap, setAssignmentsMap] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [roleFilter, setRoleFilter] = useState("All");
  const [idSort, setIdSort] = useState("");
  const [nameSort, setNameSort] = useState("");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("candidates");
  const [user, setUser] = useState({});
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user")) || {};
    setUser(userData);

    const handleClickOutside = (event) => {
      if (!event.target.closest("#profile-dropdown-container")) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Always pull fresh employee data on load so Admin's enable/disable/delete
  // changes are reflected immediately for HR — no manual refresh required.
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLocalEmployees(employees || []);
  }, [employees]);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await api("/api/reporting-managers/assignments");
        if (!res.ok) return;
        const list = await res.json();
        const map = {};
        (list || []).forEach((it) => {
          if (it && it.employeeId) {
            map[it.employeeId] = {
              managerName: it.reportingManagerName || null,
              managerEmail: it.reportingManagerEmail || null,
              managerRole: it.reportingManagerRole || null,
              hrName: it.hrName || null,
              hrRole: it.hrRole || null,
            };
          }
        });
        setAssignmentsMap(map);
      } catch (e) {
        console.error("Failed to load assignments", e);
      }
    };

    fetchAssignments();
  }, []);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      navigate("/login");
    }
  };

  const handleViewProfile = (emp) => {
    if (window.confirm("Are you sure you want to view this employee's profile?")) {
      navigate(`/admin/employee/${emp.id}`, { state: emp });
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

    // Status filter: an employee with active === false is treated as Inactive.
    const status = emp.active === false ? "Inactive" : "Active";
    const statusMatch = statusFilter === "All" || status === statusFilter;
    if (!statusMatch) return false;

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

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const navItems = getHrNavItems();

  return (
    <div className="flex h-screen bg-bg-slate font-brand text-brand-blue overflow-hidden">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        handleLogout={handleLogout}
        navItems={navItems}
        hideLogout={true}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Premium Header */}
        <header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-brand-blue/5">
          <div className="flex items-center gap-6">
            <div className="w-11 h-11 bg-brand-blue/5 rounded-xl flex items-center justify-center border border-brand-blue/10 shadow-sm overflow-hidden">
              <svg
                className="w-7 h-7 text-brand-blue/20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-brand-blue tracking-tight">
                Personnel Candidates
              </h1>
              <p className="text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
                {user.designation || "Human Resources Operations"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 relative" id="profile-dropdown-container">
            <div className="hidden md:flex items-center bg-bg-slate border border-brand-blue/10 rounded-2xl px-4 py-2 w-64 focus-within:w-80 transition-all duration-300">
              <svg className="w-4 h-4 text-brand-blue/20 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                className="bg-transparent border-none outline-none text-xs text-brand-blue placeholder-brand-blue/20 w-full font-bold"
                placeholder="Search candidates..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
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

        <div className="flex-1 p-3 md:p-6 space-y-4 flex flex-col overflow-hidden">
          <div className="bg-white rounded-[32px] shadow-2xl shadow-brand-blue/5 border border-brand-blue/5 overflow-hidden flex flex-col flex-1">
            <div className="px-6 py-3.5 border-b border-brand-blue/5 flex items-center justify-between bg-bg-slate/30">
              <div>
                <h2 className="text-2xl font-black text-brand-blue tracking-tight">Active Candidates</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-brand-blue/5 text-brand-blue px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  {processedEmployees.length} Resources
                </span>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-scroll flex-1 list-scrollbar">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-30">
                  <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-brand-blue">Syncing Database...</p>
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
                          <span>Record ID</span>
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
                              <option value="low-to-high" className="bg-white text-brand-blue text-xs normal-case font-semibold">Low to High</option>
                              <option value="high-to-low" className="bg-white text-brand-blue text-xs normal-case font-semibold">High to Low</option>
                              <option value="newest" className="bg-white text-brand-blue text-xs normal-case font-semibold">Newest</option>
                              <option value="oldest" className="bg-white text-brand-blue text-xs normal-case font-semibold">Oldest</option>
                            </select>
                            <svg className={`w-2.5 h-2.5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-colors ${idSort ? 'text-brand-yellow stroke-[5]' : 'text-brand-blue/30'}`} fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>Employee Name</span>
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
                            <svg className={`w-2.5 h-2.5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-colors ${nameSort ? 'text-brand-yellow stroke-[5]' : 'text-brand-blue/30'}`} fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>Corporate Role</span>
                          <div className="relative inline-flex items-center">
                            <select
                              value={roleFilter}
                              onChange={(e) => setRoleFilter(e.target.value)}
                              className="appearance-none bg-white border border-brand-blue/10 rounded-md px-2 py-0.5 pr-5 text-[9px] font-bold text-brand-blue/60 hover:text-brand-blue outline-none cursor-pointer focus:ring-1 focus:ring-brand-blue/10 transition-all"
                            >
                              <option value="All" className="bg-white text-brand-blue text-xs normal-case font-semibold">All Roles</option>
                              <option value="EMPLOYEE" className="bg-white text-brand-blue text-xs normal-case font-semibold">Employee</option>
                              <option value="HR" className="bg-white text-brand-blue text-xs normal-case font-semibold">HR</option>
                              <option value="REPORTING_MANAGER" className="bg-white text-brand-blue text-xs normal-case font-semibold">Reporting Manager</option>
                            </select>
                            <svg className={`w-2.5 h-2.5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-colors ${roleFilter !== 'All' ? 'text-brand-yellow stroke-[5]' : 'text-brand-blue/30'}`} fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                            </svg>
                          </div>
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>Status</span>
                          <div className="relative inline-flex items-center">
                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="appearance-none bg-white border border-brand-blue/10 rounded-md px-2 py-0.5 pr-5 text-[9px] font-bold text-brand-blue/60 hover:text-brand-blue outline-none cursor-pointer focus:ring-1 focus:ring-brand-blue/10 transition-all"
                            >
                              <option value="All" className="bg-white text-brand-blue text-xs normal-case font-semibold">All Statuses</option>
                              <option value="Active" className="bg-white text-brand-blue text-xs normal-case font-semibold">Active</option>
                              <option value="Inactive" className="bg-white text-brand-blue text-xs normal-case font-semibold">Inactive</option>
                            </select>
                            <svg className={`w-2.5 h-2.5 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-colors ${statusFilter !== 'All' ? 'text-brand-yellow stroke-[5]' : 'text-brand-blue/30'}`} fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24">
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
                          <span>HR Coordinator</span>
                          <div className="h-5" />
                        </div>
                      </th>
                      <th className="sticky top-0 bg-white z-10 py-3 px-8 text-[10px] font-black uppercase tracking-[0.2em] text-brand-blue/40 border-b border-brand-blue/5">
                        <div className="flex flex-col items-start gap-1">
                          <span>Corporate Email</span>
                          <div className="h-5" />
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-blue/5">
                    {processedEmployees.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center italic text-brand-blue/20 font-bold uppercase tracking-widest text-xs">
                          No personnel found matching search criteria
                        </td>
                      </tr>
                    ) : (
                      processedEmployees.map((emp) => (
                        <tr
                          key={emp.id}
                          className={`group hover:bg-bg-slate/50 transition-all cursor-pointer ${emp.active === false ? 'opacity-60' : ''}`}
                          onClick={() => handleViewProfile(emp)}
                        >
                          <td className="py-5 px-8">
                            <span className="text-xs font-black text-brand-blue/30 group-hover:text-brand-blue">
                              {emp.oryfolksId || "PENDING"}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-brand-blue/5 rounded-xl flex items-center justify-center text-[10px] font-black text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-all shadow-sm">
                                {(emp.firstName?.[0] || emp.lastName?.[0] || 'U')}
                              </div>
                              <span className="text-sm font-bold text-brand-blue tracking-tight">
                                {`${emp.firstName || ""} ${emp.lastName || ""}`}
                              </span>
                              {emp.active === false && <DisabledBadge />}
                            </div>
                          </td>
                          <td className="py-5 px-6">
                            <span className="px-3 py-1 bg-brand-yellow/10 text-brand-blue text-[9px] font-black uppercase tracking-widest rounded-full border border-brand-yellow/20">
                              {emp.role || 'Personnel'}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <span className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-full border ${emp.active === false ? 'bg-gray-100 text-gray-500 border-gray-200' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                              {emp.active === false ? 'Inactive' : 'Active'}
                            </span>
                          </td>
                          <td className="py-5 px-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-brand-blue/60 tabular-nums uppercase tracking-tight">
                                {emp.role === 'HR' ? adminName :
                                  emp.role === 'REPORTING_MANAGER' ? (assignmentsMap[emp.id]?.hrName || 'HR Coordinator') :
                                    (assignmentsMap[emp.id]?.managerName || 'Unassigned')}
                              </span>
                              <span className="text-[9px] font-black text-brand-blue/10 uppercase tracking-[0.1em]">Structural Lead</span>
                            </div>
                          </td>
                          <td className="py-5 px-6 text-xs font-bold text-brand-blue/60">
                            {emp.role === 'HR' ? adminName : (assignmentsMap[emp.id]?.hrName || '–')}
                          </td>
                          <td className="py-5 px-8">
                            <span className="text-xs font-bold text-brand-blue/40 group-hover:text-brand-blue transition-colors underline decoration-brand-blue/5 decoration-2 underline-offset-4 line-clamp-1">
                              {emp.corporateEmail || "await@provisioning.org"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest animate-in slide-in-from-right duration-300 ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            {toast.message}
          </div>
        )}
      </main>
    </div>
  );
}
