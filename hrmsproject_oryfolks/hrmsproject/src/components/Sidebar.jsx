
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Logo from '../assets/ORYFOLKS-logo.png';
import useSidebarCollapsed from '../hooks/useSidebarCollapsed';


const Sidebar = ({ activeTab, setActiveTab, handleLogout, navItems, hideLogout = false }) => {
	const navigate = useNavigate();
	const [collapsed, toggleCollapsed] = useSidebarCollapsed();

	const NavButton = ({ tab, label, icon, onClick, to }) => (
		<button
			type="button"
			title={collapsed ? label : undefined}
			aria-label={label}
			onClick={e => {
				e.stopPropagation();
				if (to) {
					navigate(to);
				} else if (onClick) {
					onClick();
				} else {
					setActiveTab(tab);
				}
			}}
			className={`btn-sidebar w-full flex items-center mb-2 ${collapsed ? 'justify-center px-0!' : 'gap-3'} ${activeTab === tab
				? 'btn-sidebar-active'
				: 'text-white/60 hover:text-brand-yellow transition-colors'
				}`}
		>
			{/* Enlarge icons slightly in collapsed mode so they stay clearly visible/clickable */}
			<span className={`flex items-center justify-center transition-transform ${collapsed ? 'scale-125' : ''}`}>{icon}</span>
			{!collapsed && <span className="font-semibold whitespace-nowrap">{label}</span>}
		</button>
	);

	return (
		<aside className={`${collapsed ? 'w-20' : 'w-64'} shrink-0 bg-brand-blue text-white flex flex-col hidden md:flex h-screen sticky top-0 shadow-xl overflow-hidden transition-[width] duration-300 ease-in-out`}>

			{/* Logo + Collapse Toggle */}
			<div className={`p-4 border-b border-white/5 flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
				{!collapsed && <img src={Logo} alt="ORYFOLKS Logo" className="h-10 w-auto max-w-[150px] min-w-0 object-contain" />}
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

			{/* Navigation */}
			<nav className={`flex-1 py-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide ${collapsed ? 'px-2' : 'px-4'}`}>
				{navItems.map((item, index) => {
					if (item.type === 'heading') {
						if (collapsed) {
							return <div key={`heading-${index}`} className="my-3 mx-2 border-t border-white/10" />;
						}
						return (
							<div key={`heading-${index}`} className="px-4 pt-4 pb-2 text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">
								{item.label}
							</div>
						);
					}
					return (
						<NavButton
							key={item.tab || index}
							tab={item.tab}
							label={item.label}
							icon={item.icon}
							onClick={item.onClick}
							to={item.to}
						/>
					);
				})}
			</nav>

			{/* Logout Button */}
			{!hideLogout && (
				<div className={`border-t border-white/5 ${collapsed ? 'p-2' : 'p-4'}`}>
					<button
						onClick={handleLogout}
						title={collapsed ? 'Logout' : undefined}
						aria-label="Logout"
						className={`w-full flex items-center justify-center gap-2 py-3 bg-brand-yellow/10 border border-brand-yellow/20 text-brand-yellow rounded-xl text-sm font-bold hover:bg-brand-yellow hover:text-brand-blue transition-all active:scale-[0.98] ${collapsed ? 'px-0' : ''}`}
					>
						<svg
							className={`shrink-0 ${collapsed ? 'w-5 h-5' : 'w-4 h-4'}`}
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
							<polyline points="16 17 21 12 16 7"></polyline>
							<line x1="21" y1="12" x2="9" y2="12"></line>
						</svg>
						{!collapsed && <span>LOGOUT</span>}
					</button>
				</div>
			)}
		</aside>
	);
};

export default Sidebar;
