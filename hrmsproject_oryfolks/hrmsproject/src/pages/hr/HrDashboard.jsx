import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../utils/api";

import LeaveRequestPage from "../employee/LeaveRequestPage";
import Sidebar from '../../components/Sidebar';
import PersonalTimesheetContent from "../employee/PersonalTimesheetContent";
import EmployeeOwnProfile from "../employee/EmployeeOwnProfile";
import { getHrNavItems } from "../../utils/hrNav";
import NotificationComponent from "../../components/NotificationComponent";
import { Eye } from "lucide-react";
import LeaveDetailsModal from "../../components/LeaveDetailsModal";

const HrDashboard = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [activeTab, setActiveTab] = useState("dashboard");
	const [user, setUser] = useState({});
	const [employeeId, setEmployeeId] = useState(null);
	const [leaveBalance, setLeaveBalance] = useState(null);
	const [recentLeaves, setRecentLeaves] = useState([]);
	const [recentTimesheets, setRecentTimesheets] = useState([]);
	const [loading, setLoading] = useState(true);
	const [timesheetLoading, setTimesheetLoading] = useState(false);
	const [error, setError] = useState("");
	const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
	const [initialWeekKey, setInitialWeekKey] = useState(null);
	const [viewTimesheetWeek, setViewTimesheetWeek] = useState(null);
	const [selectedLeave, setSelectedLeave] = useState(null);
	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

	const getWorkedDays = (entries) => {
		if (!entries || entries.length === 0) return 0;
		const uniqueDates = new Set();
		entries.forEach(entry => {
			if (!entry.date) return;
			const dateStr = entry.date.split('T')[0];
			const parts = dateStr.split('-');
			if (parts.length !== 3) return;
			const year = parseInt(parts[0], 10);
			const month = parseInt(parts[1], 10) - 1;
			const day = parseInt(parts[2], 10);
			const d = new Date(year, month, day);
			const dayOfWeek = d.getDay();
			const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
			const isLop = entry.category === 'LEAVE' && entry.leaveType === 'L';
			if (!isWeekend && !isLop) {
				uniqueDates.add(dateStr);
			}
		});
		return uniqueDates.size;
	};

	useEffect(() => {
		const userData = JSON.parse(localStorage.getItem("user")) || {};
		setUser(userData);
		fetchEmployeeProfile();

		const handleClickOutside = (event) => {
			if (!event.target.closest("#profile-dropdown-container")) {
				setIsProfileDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const tab = params.get('tab');
		if (tab && ["dashboard", "timesheet", "leave", "profile"].includes(tab)) {
			setActiveTab(tab);
		} else {
			setActiveTab("dashboard");
		}
	}, [location]);

	// Sync user data from localStorage when switching tabs
	useEffect(() => {
		const userData = JSON.parse(localStorage.getItem("user")) || {};
		setUser(userData);
	}, [activeTab]);

	const fetchEmployeeProfile = async () => {
		try {
			const response = await api("/api/me/employee");

			if (response.ok) {
				const result = await response.json();
				const employeeData = result.data || result;

				if (employeeData && employeeData.id) {
					setEmployeeId(employeeData.id);

					const storedUser = JSON.parse(localStorage.getItem("user")) || {};
					const newUser = {
						...storedUser,
						employeeId: employeeData.id,
						firstName: employeeData.firstName || storedUser.firstName,
						lastName: employeeData.lastName || storedUser.lastName,
						photoPath: employeeData.photoPath || storedUser.photoPath,
						designation: employeeData.designation || storedUser.designation || "HR",
						companyMail: employeeData.corporateEmail || storedUser.companyMail || "",
						fullName: employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName}` : (storedUser.fullName || "HR"),
						reportingManagerName: employeeData.reportingManagerName || storedUser.reportingManagerName || "N/A",
						hrName: employeeData.hrName || storedUser.hrName || "N/A"
					};
					setUser(newUser);
					localStorage.setItem("user", JSON.stringify(newUser));

					fetchLeaveData(employeeData.id);
					fetchTimesheetData(employeeData.id);
				} else {
					setError("User profile is missing employee details");
					setLoading(false);
				}
			} else {
				const errorData = await response.json().catch(() => ({}));
				setError(errorData.message || "User details are not loaded. Please re-login.");
				setLoading(false);
			}
		} catch (err) {
			console.error("Error fetching employee profile:", err);
			setError("Connection error. Could not load user details.");
			setLoading(false);
		}
	};

	const fetchLeaveData = async (employeeId) => {
		try {
			setLoading(true);

			const balanceResponse = await api(`/api/leaves/balance/${employeeId}`);

			if (balanceResponse.ok) {
				const balanceData = await balanceResponse.json();
				setLeaveBalance(balanceData.data);
			}

			const allLeavesResponse = await api(`/api/leaves`);

			if (allLeavesResponse.ok) {
				const allLeavesData = await allLeavesResponse.json();
				let allLeavesList = allLeavesData.data || allLeavesData || [];
				let allLeaves = allLeavesList.filter(l => String(l.employeeId) === String(employeeId));
				allLeaves = allLeaves.sort((a, b) => {
					if (a.status === 'PENDING' && b.status !== 'PENDING') return -1;
					if (a.status !== 'PENDING' && b.status === 'PENDING') return 1;
					const dateA = a.submittedAt || a.startDate;
					const dateB = b.submittedAt || b.startDate;
					return new Date(dateB) - new Date(dateA);
				});
				setRecentLeaves(allLeaves);
			}

			setError("");
		} catch (err) {
			console.error("Error fetching leave data:", err);
			setError("Failed to load leave information");
		} finally {
			setLoading(false);
		}
	};

	const groupIntoWeeksSummary = (data) => {
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

		const getSaturday = (dateStr) => {
			const date = parseDateLocal(dateStr);
			const day = date.getDay(); // 0 (Sun) to 6 (Sat)
			const diff = (day + 1) % 7;
			date.setDate(date.getDate() - diff);
			date.setHours(0, 0, 0, 0);
			return date;
		};

		const formatShortDate = (date) => {
			return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
		};

		data.forEach(entry => {
			const sat = getSaturday(entry.date);
			const year = sat.getFullYear();
			const month = (sat.getMonth() + 1).toString().padStart(2, '0');
			const day = sat.getDate().toString().padStart(2, '0');
			const weekKey = `${year}-${month}-${day}`;

			if (!weeksMap[weekKey]) {
				const fri = new Date(sat);
				fri.setDate(sat.getDate() + 6);
				weeksMap[weekKey] = {
					weekKey,
					start: sat,
					end: fri,
					startDateStr: formatShortDate(sat),
					endDateStr: formatShortDate(fri),
					totalHours: 0,
					status: 'APPROVED',
					entries: []
				};
			}

			const week = weeksMap[weekKey];
			week.entries.push(entry);
			week.totalHours += entry.totalHours || 0;

			if (entry.status === 'PENDING') {
				week.status = entry.reapplyUsed ? 'REAPPROVAL_PENDING' : 'PENDING';
			} else if (entry.status === 'REAPPLY_REQUESTED' && week.status !== 'PENDING' && week.status !== 'REAPPROVAL_PENDING') {
				week.status = 'REAPPLY_REQUESTED';
			} else if (entry.status === 'REJECTED' && week.status !== 'PENDING' && week.status !== 'REAPPROVAL_PENDING') {
				week.status = 'REJECTED';
			}
		});

		return Object.values(weeksMap).sort((a, b) => b.start - a.start);
	};

	const fetchTimesheetData = async (id) => {
		if (!id) return;
		try {
			setTimesheetLoading(true);
			const response = await api(`/api/timesheets?employeeId=${id}`);
			if (response.ok) {
				const result = await response.json();
				const data = result.data || [];
				const grouped = groupIntoWeeksSummary(data);
				setRecentTimesheets(grouped);
			}
		} catch (err) {
			console.error("Error fetching timesheet data:", err);
		} finally {
			setTimesheetLoading(false);
		}
	};

	const handleRefreshData = () => {
		if (employeeId) {
			fetchLeaveData(employeeId);
			fetchTimesheetData(employeeId);
		}
	};

	const handleLogout = () => {
		if (window.confirm('Are you sure you want to logout?')) {
			localStorage.removeItem("user");
			localStorage.removeItem("token");
			window.location.href = "/login";
		}
	};


	const getStatusColor = (status) => {
		switch (status?.toUpperCase()) {
			case 'APPROVED':
				return 'bg-emerald-500 text-white';
			case 'PENDING':
				return 'bg-yellow-400 text-slate-900';
			case 'REJECTED':
				return 'bg-red-600 text-white';
			default:
				return 'bg-gray-400 text-white';
		}
	};

	const formatDate = (dateString) => {
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
				{/* Conditional Header */}
				{activeTab === 'dashboard' ? (
					<header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-brand-blue/5">
						<div className="flex items-center gap-6">

							<div>
								<h1 className="text-xl font-black text-brand-blue tracking-tight">
									Hi, {(user.firstName) ? user.firstName : "User"}!
								</h1>
								<p className="text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
									{"HR" || "Human Resources Operations"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3 relative" id="profile-dropdown-container">
							<NotificationComponent />
							<button
								onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
								className="w-10 h-10 rounded-full border-2 border-brand-yellow overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center bg-white p-0"
								title="My Profile"
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
				) : (
					<header className="bg-white px-8 py-4 flex items-center justify-between shadow-sm z-10 border-b border-brand-blue/5">
						<div className="flex items-center gap-6">

							<div>
								<h1 className="text-xl font-black text-brand-blue tracking-tight">
									{activeTab === 'timesheet' ? 'My Timesheet' : activeTab === 'leave' ? 'My Leave Management' : activeTab === 'profile' ? 'My Profile' : 'Human Resources Operations'}
								</h1>
								<p className="text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
									{activeTab === 'profile' ? 'Profile Management' : 'Personal Workspace'}
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
				)}

				<div className={`flex-1 overflow-auto ${activeTab === 'timesheet' ? 'p-4 md:px-10 md:py-4' : 'p-4 md:p-10'} ${activeTab === 'timesheet' ? 'space-y-4' : 'space-y-8'}`}>
					{activeTab === 'dashboard' && (
						viewTimesheetWeek ? (
							<PersonalTimesheetContent
								employeeId={employeeId}
								user={user}
								initialWeekKey={viewTimesheetWeek}
								onClearInitialWeekKey={() => {}}
								onBackToDashboard={() => setViewTimesheetWeek(null)}
							/>
						) : (
							<>
							{error && (
								<div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-sm font-medium">
									{error}
								</div>
							)}

							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
								{loading ? (
									<div className="col-span-full text-center text-brand-blue/30 py-10 animate-pulse font-bold uppercase tracking-widest text-xs">Loading leave data...</div>
								) : leaveBalance ? (
									[
										{
											label: "Total Leaves",
											value: String((leaveBalance.casualLeavesRemaining || 0) + (leaveBalance.sickLeavesRemaining || 0) + (leaveBalance.earnedLeavesRemaining || 0)).padStart(2, '0'),
											color: "text-brand-blue"
										},
										{
											label: "Casual Leaves",
											value: String(leaveBalance.casualLeavesRemaining || 0).padStart(2, '0'),
											color: "text-brand-yellow"
										},
										{
											label: "Sick Leaves",
											value: String(leaveBalance.sickLeavesRemaining || 0).padStart(2, '0'),
											color: "text-red-500"
										},
										{
											label: "Earned Leaves",
											value: String(leaveBalance.earnedLeavesRemaining || 0).padStart(2, '0'),
											color: "text-emerald-500"
										},
									].map((stat, index) => (
										<div key={index} className="bg-white rounded-2xl p-6 shadow-sm border border-brand-blue/5 card-hover flex flex-col items-center">
											<div className="text-brand-blue/40 text-[10px] font-bold uppercase tracking-widest mb-2 text-center">{stat.label}</div>
											<div className={`text-4xl font-black ${stat.color}`}>{stat.value}</div>
										</div>
									))
								) : (
									<div className="col-span-full text-center text-brand-blue/30 py-10 font-bold uppercase tracking-widest text-xs">No leave balance found</div>
								)}
							</div>

							<div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-blue/5 card-hover">
								<div className="px-6 py-4 border-b border-brand-blue/5 bg-brand-blue">
									<h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Time sheet</h2>
								</div>
								<div className="overflow-x-auto max-h-[290px] overflow-y-auto">
									<table className="w-full text-left border-collapse text-sm">
										<thead className="bg-bg-slate sticky top-0 z-10">
											<tr className="text-brand-blue/40 font-bold uppercase tracking-widest text-[9px]">
												<th className="p-4 px-6 border-b border-brand-blue/5">Week Period</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Status</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-center">Entries</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-right whitespace-nowrap">Total Hours</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-right">Action</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-brand-blue/5">
											{timesheetLoading ? (
												<tr>
													<td colSpan="5" className="p-8 text-center text-brand-blue/30 font-bold uppercase tracking-widest text-[10px]">Loading weekly history...</td>
												</tr>
											) : recentTimesheets.length > 0 ? (
												recentTimesheets.map((week) => (
													<tr key={week.weekKey} className="hover:bg-bg-slate transition-colors font-medium">
														<td className="p-4 px-6">
															<div className="flex flex-col">
																<span className="font-bold text-brand-blue uppercase text-xs">Week of {week.startDateStr}</span>
																<span className="text-[10px] text-brand-blue/40 font-bold">{week.startDateStr} — {week.endDateStr}</span>
															</div>
														</td>
														<td className="p-4 px-6">
															<span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${week.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : week.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-brand-yellow/10 text-brand-yellow'}`}>
																{week.status.replace('_', ' ')}
															</span>
														</td>
														<td className="p-4 px-6 text-center text-brand-blue/60">{getWorkedDays(week.entries)} Days</td>
														<td className="p-4 px-6 text-right font-black text-brand-blue">{week.totalHours.toFixed(1)}</td>
														<td className="p-4 px-6 text-right">
															<button
																onClick={() => {
																	setViewTimesheetWeek(week.weekKey);
																}}
																className="px-3 py-1.5 bg-brand-blue/5 text-brand-blue rounded-lg hover:bg-brand-blue hover:text-white font-black uppercase text-[9px] tracking-widest transition-all shadow-sm"
															>
																View Details
															</button>
														</td>
													</tr>
												))
											) : (
												<tr>
													<td colSpan="5" className="p-8 text-center text-brand-blue/20 font-bold uppercase tracking-widest text-[10px]">No recent timesheets found</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>

							<div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-brand-blue/5 card-hover">
								<div className="px-6 py-4 border-b border-brand-blue/5 bg-brand-blue">
									<h2 className="text-xs font-bold text-white uppercase tracking-[0.2em]">Recent Leave History</h2>
								</div>
								<div className="overflow-x-auto max-h-[290px] overflow-y-auto">
									<table className="w-full text-left border-collapse text-sm">
										<thead className="bg-bg-slate sticky top-0 z-10">
											<tr className="text-brand-blue/40 font-bold uppercase tracking-widest text-[9px]">
												<th className="p-4 px-6 border-b border-brand-blue/5">Type</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Dates</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Status</th>
												<th className="p-4 px-6 border-b border-brand-blue/5">Approved By</th>
												<th className="p-4 px-6 border-b border-brand-blue/5 text-right">Actions</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-brand-blue/5">
											{loading ? (
												<tr>
													<td colSpan="5" className="p-8 text-center text-brand-blue/30 font-bold uppercase tracking-widest text-[10px]">Loading leave history...</td>
												</tr>
											) : recentLeaves.length > 0 ? (
												recentLeaves.map((leave) => (
													<tr key={leave.id} className="hover:bg-bg-slate transition-colors font-medium">
														<td className="p-4 px-6 font-bold text-brand-blue uppercase text-xs">{leave.leaveType}</td>
														<td className="p-4 px-6 text-brand-blue/70">
															{formatDate(leave.startDate)} → {formatDate(leave.endDate)}
														</td>
														<td className="p-4 px-6">
															<span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${getStatusColor(leave.status)}`}>
																{leave.status}
															</span>
														</td>
														<td className="p-4 px-6">
															{leave.approvedBy ? (
																<div className="space-y-0.5">
																	<p className="font-bold text-brand-blue text-xs uppercase">{leave.approvedBy}</p>
																	{leave.reviewedAt && (
																		<p className="text-[10px] text-brand-blue/40 font-bold">{formatDateTime(leave.reviewedAt)}</p>
																	)}
																</div>
															) : (
																<span className="text-brand-blue/30 text-xs italic">Pending review</span>
															)}
														</td>
														<td className="p-4 px-6 text-right">
															<div className="flex justify-end gap-2">
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
															</div>
														</td>
													</tr>
												))
											) : (
												<tr>
													<td colSpan="6" className="p-8 text-center text-brand-blue/30 font-bold uppercase tracking-widest text-[10px]">No leave history found</td>
												</tr>
											)}
										</tbody>
									</table>
								</div>
							</div>
						</>
						)
					)}

					{activeTab === 'timesheet' && (
						<PersonalTimesheetContent
							employeeId={employeeId}
							user={user}
							initialWeekKey={initialWeekKey}
							onClearInitialWeekKey={() => setInitialWeekKey(null)}
							onBackToDashboard={() => setActiveTab("dashboard")}
						/>
					)}

					{activeTab === 'leave' && (
						<LeaveRequestPage
							employeeId={employeeId}
							leaveBalance={leaveBalance}
							onLeaveRequestSuccess={handleRefreshData}
						/>
					)}

					{activeTab === 'profile' && (
						<EmployeeOwnProfile hideSidebar={true} />
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
};

export default HrDashboard;
