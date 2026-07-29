import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../../utils/api";

import LeaveRequestPage from "./LeaveRequestPage";
import PersonalTimesheetContent from "./PersonalTimesheetContent";
import EmployeeOwnProfile from "./EmployeeOwnProfile";
import Sidebar from '../../components/Sidebar';
import { Eye } from "lucide-react";
import LeaveDetailsModal from "../../components/LeaveDetailsModal";
import NotificationComponent from "../../components/NotificationComponent";

const EmployeeDashboard = () => {
	const navigate = useNavigate();
	const location = useLocation();
	const [activeTab, setActiveTab] = useState("dashboard");
	const [user, setUser] = useState({});
	const [currentDate, setCurrentDate] = useState("");
	const [employeeId, setEmployeeId] = useState(null); // Added state
	const [leaveBalance, setLeaveBalance] = useState(null);
	const [recentLeaves, setRecentLeaves] = useState([]);
	const [recentTimesheets, setRecentTimesheets] = useState([]);
	const [loading, setLoading] = useState(true);
	const [timesheetLoading, setTimesheetLoading] = useState(false);
	const [error, setError] = useState("");
	const [selectedLeave, setSelectedLeave] = useState(null);
	const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
	const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [initialWeekKey, setInitialWeekKey] = useState(null);
	const [viewTimesheetWeek, setViewTimesheetWeek] = useState(null);

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
		const params = new URLSearchParams(location.search);
		const tabParam = params.get("tab");
		if (tabParam && ["dashboard", "timesheet", "leave", "profile"].includes(tabParam)) {
			setActiveTab(tabParam);
		} else {
			setActiveTab("dashboard");
		}
	}, [location.search]);

	// Sync user data from localStorage when switching back to dashboard
	useEffect(() => {
		const userData = JSON.parse(localStorage.getItem("user")) || {};
		setUser(userData);
	}, [activeTab]);

	useEffect(() => {
		const userData = JSON.parse(localStorage.getItem("user")) || {};
		setUser(userData);

		const today = new Date();
		const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
		setCurrentDate(today.toLocaleDateString('en-GB', options));

		// Fetch correct employee ID first
		fetchEmployeeProfile();

		// Click outside to close dropdown
		const handleClickOutside = (event) => {
			if (!event.target.closest("#profile-dropdown-container")) {
				setIsProfileDropdownOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const fetchEmployeeProfile = async () => {
		try {
			const response = await api("/api/me/employee");

			if (response.ok) {
				const result = await response.json();
				const employeeData = result.data || result;

				if (employeeData && employeeData.id) {
					console.log("Fetched correct employee ID:", employeeData.id);
					setEmployeeId(employeeData.id);

					// Sync back to user state and storage
					const storedUser = JSON.parse(localStorage.getItem("user")) || {};
					const newUser = {
						...storedUser,
						employeeId: employeeData.id,
						firstName: employeeData.firstName || storedUser.firstName,
						lastName: employeeData.lastName || storedUser.lastName,
						photoPath: employeeData.photoPath || storedUser.photoPath,
						designation: employeeData.designation || storedUser.designation || "Team Member",
						companyMail: employeeData.corporateEmail || storedUser.companyMail || "",
						fullName: employeeData.firstName ? `${employeeData.firstName} ${employeeData.lastName}` : (storedUser.fullName || "Employee"),
						reportingManagerName: employeeData.reportingManagerName || storedUser.reportingManagerName || "N/A",
						hrName: employeeData.hrName || storedUser.hrName || "N/A",
						// Track whether the RM/HR accounts are disabled so we can show "(Disabled)" beside their name.
						reportingManagerActive: employeeData.reportingManagerActive,
						hrActive: employeeData.hrActive
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

			// Fetch leave balance
			const balanceResponse = await api(`/api/leaves/balance/${employeeId}`);

			if (balanceResponse.ok) {
				const balanceData = await balanceResponse.json();
				setLeaveBalance(balanceData.data);
			}

			// Fetch all leaves, sorted by newest first
			const allLeavesResponse = await api(`/api/leaves/employee/${employeeId}`);

			if (allLeavesResponse.ok) {
				const allLeavesData = await allLeavesResponse.json();
				let allLeaves = allLeavesData.data || [];
				// Sort by submittedAt or startDate, newest first
				allLeaves = allLeaves.sort((a, b) => {
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

			if (entry.status === 'PENDING') week.status = 'PENDING';
			else if (entry.status === 'REJECTED' && week.status !== 'PENDING') week.status = 'REJECTED';
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
			console.log('User logged out');
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

	const navItems = [
		{
			tab: "dashboard",
			label: "Dashboard",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3" y="3" width="7" height="7"></rect>
					<rect x="14" y="3" width="7" height="7"></rect>
					<rect x="14" y="14" width="7" height="7"></rect>
					<rect x="3" y="14" width="7" height="7"></rect>
				</svg>
			)
		},
		{
			tab: "timesheet",
			label: "Timesheet",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<polyline points="12 6 12 12 16 14"></polyline>
				</svg>
			)
		},
		{
			tab: "leave",
			label: "Leave Request",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
					<polyline points="14 2 14 8 20 8"></polyline>
					<line x1="16" y1="13" x2="8" y2="13"></line>
					<line x1="16" y1="17" x2="8" y2="17"></line>
					<polyline points="10 9 9 9 8 9"></polyline>
				</svg>
			)
		}
	];

	// Add HR Actions if user is HR
	if (user.role === 'HR') {
		navItems.push({
			tab: "actions",
			label: "Actions",
			icon: (
				<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<circle cx="12" cy="12" r="10"></circle>
					<line x1="12" y1="8" x2="12" y2="12"></line>
					<line x1="12" y1="16" x2="12" y2="16"></line>
				</svg>
			),
			to: "/hr/actions",
		});
	}

	return (
		<div className="flex min-h-screen bg-bg-slate font-brand text-brand-blue">
			{/* Mobile Hamburger Button */}
			<button
				onClick={() => setIsMobileMenuOpen(true)}
				className={`md:hidden fixed top-4 left-4 z-50 bg-brand-yellow text-brand-blue rounded-lg p-2 shadow-lg transition-all active:scale-95 ${isMobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
			>
				<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
				</svg>
			</button>

			{/* Sidebar - Desktop & Mobile Drawer */}
			<div className={`fixed inset-0 z-50 md:relative md:flex md:inset-auto ${isMobileMenuOpen ? 'flex' : 'hidden md:flex'}`}>
				{/* Mobile Overlay */}
				<div
					className="absolute inset-0 bg-brand-blue/60 backdrop-blur-sm md:hidden"
					onClick={() => setIsMobileMenuOpen(false)}
				/>

				<div className={`relative w-64 md:w-auto h-full md:h-auto animate-in slide-in-from-left duration-300 md:animate-none`}>
					{/* Mobile Close Button */}
					<button
						onClick={() => setIsMobileMenuOpen(false)}
						className="md:hidden absolute top-4 right-4 z-50 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>

					<Sidebar
						activeTab={activeTab}
						setActiveTab={(tab) => {
							setActiveTab(tab);
							setIsMobileMenuOpen(false);
						}}
						handleLogout={handleLogout}
						navItems={navItems}
						hideLogout={true}
					/>
				</div>
			</div>

			{/* Main Content */}
			<main className="flex-1 flex flex-col">
				{/* Conditional Header */}
				{activeTab === 'dashboard' ? (
					<header className="bg-white px-4 md:px-8 py-4 flex items-center justify-between shadow-sm z-40 border-b border-brand-blue/5">
						<div className="flex items-center gap-3 sm:gap-6 ml-12 md:ml-0">
							<div>
								<h1 className="text-lg md:text-2xl font-black text-brand-blue tracking-tight line-clamp-1">
									Hi, {(user.firstName) ? user.firstName : "User"}!
								</h1>
								<p className="text-[8px] md:text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
									Employee | {user.designation || "Employee"}
								</p>
							</div>
						</div>
						<div className="flex items-center gap-3 relative" id="profile-dropdown-container">
							<NotificationComponent />
							<button
								onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
								className="w-11 h-11 rounded-full border-2 border-brand-yellow overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center bg-white p-0"
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
												{user.reportingManagerActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}
											</p>
										</div>
										<div>
											<p className="text-[9px] font-black text-brand-blue/40 uppercase tracking-[0.15em] mb-1">
												HR Coordinator
											</p>
											<p className="text-sm font-extrabold text-brand-blue tracking-tight">
												{user.hrName || "N/A"}
												{user.hrActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}
											</p>
										</div>
									</div>

									<div className="h-px bg-brand-blue/5 my-4"></div>

									{/* Adjacent Buttons */}
									<div className="flex gap-2.5">
										<button
											onClick={() => {
												navigate("/employee?tab=profile");
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
					<header className="bg-white px-4 md:px-8 py-4 flex items-center justify-between shadow-sm z-40 border-b border-brand-blue/5">
						<div className="flex items-center gap-3 sm:gap-6 ml-12 md:ml-0">
							<div>
								<h1 className="text-base md:text-xl font-black text-brand-blue tracking-tight line-clamp-1">
									{user.fullName || "Employee Name"}
								</h1>
								<p className="text-[8px] md:text-[10px] text-brand-blue/40 uppercase font-black tracking-[0.2em] mt-0.5">
									{activeTab === 'timesheet' ? 'Timesheet Management' : activeTab === 'profile' ? 'Profile Management' : 'Leave Management System'}
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
												{user.reportingManagerActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}
											</p>
										</div>
										<div>
											<p className="text-[9px] font-black text-brand-blue/40 uppercase tracking-[0.15em] mb-1">
												HR Coordinator
											</p>
											<p className="text-sm font-extrabold text-brand-blue tracking-tight">
												{user.hrName || "N/A"}
												{user.hrActive === false && <span className="ml-1 font-bold text-[#5F5E5A]">(Disabled)</span>}
											</p>
										</div>
									</div>

									<div className="h-px bg-brand-blue/5 my-4"></div>

									{/* Adjacent Buttons */}
									<div className="flex gap-2.5">
										<button
											onClick={() => {
												navigate("/employee?tab=profile");
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

				{/* Content Area */}
				<div className={`flex-1 ${activeTab === 'profile' ? 'p-2 md:p-6' : activeTab === 'timesheet' ? 'p-3 md:px-8 md:py-4' : 'p-3 md:p-8'} flex flex-col ${activeTab === 'profile' ? 'gap-2' : activeTab === 'timesheet' ? 'gap-4 md:gap-5' : 'gap-6 md:gap-8'}`}>
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

							{/* Stats Gri d */}
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
											<div className="text-brand-blue/40 text-[10px] font-bold uppercase tracking-widest mb-2">{stat.label}</div>
											<div className={`text-4xl font-black ${stat.color}`}>{stat.value}</div>
										</div>
									))
								) : (
									<div className="col-span-full text-center text-brand-blue/30 py-10 font-bold uppercase tracking-widest text-xs">No leave balance found</div>
								)}
							</div>

							{/* Time Sheet Tabl e */}
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
																{week.status}
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

							{/* Recent Leave History Tabl e */}
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
																		<p className="text-[10px] text-brand-blue/40 font-bold">{formatDate(leave.reviewedAt)}</p>
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
													<td colSpan="5" className="p-8 text-center text-brand-blue/30 font-bold uppercase tracking-widest text-[10px]">No leave history found</td>
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

export default EmployeeDashboard;

