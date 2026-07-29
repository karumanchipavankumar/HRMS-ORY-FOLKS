import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Logo from '../assets/ORYFOLKS-logo.png';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  ShieldCheck,
  CalendarDays,
  Settings2,
  LogOut,
  Clock,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import useSidebarCollapsed from '../hooks/useSidebarCollapsed';

export default function AdminSidebar({ activeTab, setActiveTab, onLogout }) {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  const user = JSON.parse(localStorage.getItem("user")) || {};
  const isManager = user.role === "REPORTING_MANAGER";

  const formatDisplayName = () => {
    const u = JSON.parse(localStorage.getItem("user")) || {};
    if (!u.firstName) return "Admin User";
    const last = u.lastName || "";
    if (last.toLowerCase() === "admin") {
      return u.firstName;
    }
    return `${u.firstName} ${last}`.trim();
  };

  const handleTabClick = (tab) => {
    if (setActiveTab) setActiveTab(tab);
    if (tab === "dashboard" || tab === "hr-team" || tab === "leave-requests") {
      navigate(isManager ? "/reporting-dashboard" : "/admin", { state: { tab } });
    }
    else if (tab === "candidates" || tab === "team") navigate(isManager ? "/reporting-team" : "/admin/candidates");
    else if (tab === "reporting-managers") navigate("/admin/reporting-managers");
    else if (tab === "timesheets") navigate("/admin/timesheets");
    setMobileOpen(false);
  };

  const navLinks = isManager
    ? [
      { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { id: "team", label: "My Team", Icon: Users }
    ]
    : [
      { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
      { id: "candidates", label: "Employees", Icon: Users },
      { id: "reporting-managers", label: "Managers", Icon: UsersRound },
      { id: "hr-team", label: "HR Team", Icon: ShieldCheck },
      { id: "leave-requests", label: "Leaves", Icon: CalendarDays },
      { id: "timesheets", label: "Timesheets", Icon: Clock }
    ];

  // Mobile hamburger (fixed) — hide when drawer open
  return (
    <>
      <button
        className={`md:hidden fixed top-4 left-4 z-50 bg-brand-yellow text-brand-blue rounded-md p-2 ${mobileOpen ? 'hidden' : 'block shadow-md'}`}
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        ☰
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-[277px] bg-brand-blue text-white h-full p-6 shadow-2xl">
            <button
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-colors"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              ✕
            </button>
            <div className="text-center mb-4 pt-4">
              <img src={Logo} alt="ORYFOLKS Logo" className="h-16 w-16 mx-auto mb-2 rounded-full object-contain bg-white p-1" />
              <h1 className="text-xl font-bold">
                {formatDisplayName()}
              </h1>
              <p className="text-sm opacity-60 uppercase tracking-widest mt-1">
                {JSON.parse(localStorage.getItem("user"))?.role === 'ADMIN' ? 'Admin' : (JSON.parse(localStorage.getItem("user"))?.role === 'REPORTING_MANAGER' ? 'Manager' : JSON.parse(localStorage.getItem("user"))?.role || 'Admin')}
              </p>
            </div>

            <nav className="flex flex-col gap-2">
              {navLinks.map(({ id, label, Icon }) => (
                <div
                  key={id}
                  onClick={() => handleTabClick(id)}
                  className={`btn-sidebar flex items-center gap-3 transition-colors ${activeTab === id
                    ? 'btn-sidebar-active'
                    : 'text-white/60 hover:text-brand-yellow'
                    }`}
                >
                  <Icon size={18} className={activeTab === id ? 'text-black' : 'inherit'} />
                  <span className="font-semibold">{label}</span>
                </div>
              ))}
            </nav>

            <div className="mt-auto pt-6">
              <button
                onClick={() => { onLogout(); setMobileOpen(false); }}
                className="w-full bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow py-3 rounded-xl text-lg font-bold hover:bg-brand-yellow hover:text-brand-blue transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={20} />
                Logout
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <aside className={`hidden md:flex ${collapsed ? 'md:w-20' : 'md:w-[277px]'} w-full bg-brand-blue text-white flex-col flex-shrink-0 shadow-xl z-20 h-screen sticky top-0 overflow-hidden transition-[width] duration-300 ease-in-out`}>
        <div className={`border-b border-white/5 flex items-center gap-2 ${collapsed ? 'p-4 justify-center' : 'p-6 justify-between'}`}>
          {!collapsed && (
            <div className="flex flex-col items-center text-center min-w-0 flex-1">
              <img src={Logo} alt="ORYFOLKS Logo" className="h-10 mb-2 object-contain" />
              <h1 className="text-base font-bold truncate w-full text-center">
                {formatDisplayName()}
              </h1>
              <p className="text-[10px] opacity-40 uppercase tracking-[0.2em] mt-1 font-bold truncate w-full text-center">
                {JSON.parse(localStorage.getItem("user"))?.role === 'ADMIN' ? 'Admin' : (JSON.parse(localStorage.getItem("user"))?.role === 'REPORTING_MANAGER' ? 'Manager' : JSON.parse(localStorage.getItem("user"))?.role || 'Admin')}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            aria-label={collapsed ? 'Show Sidebar' : 'Hide Sidebar'}
            aria-expanded={!collapsed}
            className="shrink-0 w-9 h-9 rounded-lg bg-white/5 text-white/70 flex items-center justify-center hover:bg-white/15 hover:text-brand-yellow transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-yellow"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        <nav className={`flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'px-4'}`}>
          {navLinks.map(({ id, label, Icon }) => (
            <div
              key={id}
              onClick={() => handleTabClick(id)}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={`btn-sidebar flex items-center transition-colors ${collapsed ? 'justify-center px-0!' : 'gap-3'} ${activeTab === id
                ? 'btn-sidebar-active'
                : 'text-white/60 hover:text-brand-yellow'
                }`}
            >
              <Icon size={collapsed ? 24 : 18} className={activeTab === id ? 'text-black' : 'inherit'} />
              {!collapsed && <span className="font-semibold tracking-tight whitespace-nowrap">{label}</span>}
            </div>
          ))}
        </nav>

        <div className={`border-t border-white/5 ${collapsed ? 'p-2' : 'p-4'}`}>
          <button
            onClick={onLogout}
            title={collapsed ? 'Logout' : undefined}
            aria-label="Logout"
            className={`w-full bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow py-3 rounded-xl text-sm font-bold hover:bg-brand-yellow hover:text-brand-blue transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${collapsed ? 'px-0' : ''}`}
          >
            <LogOut size={collapsed ? 20 : 16} className="shrink-0" />
            {!collapsed && "LOGOUT"}
          </button>
        </div>
      </aside>
    </>
  );
}


