import React, { useState } from 'react';

const TimesheetSummary = ({ weeks, onSelectWeek }) => {
    const [statusFilter, setStatusFilter] = useState('All');

    const filteredWeeks = weeks.filter(week => {
        if (statusFilter === 'All') return true;
        return week.status.toLowerCase() === statusFilter.toLowerCase();
    });

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Search/Header section */}
            <div className="bg-white py-3 px-5 md:py-4 md:px-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex flex-col gap-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Guidelines</p>
                    <p className="text-xs md:text-sm text-slate-600">Please ensure your timesheets are submitted accurately and on time. Once approved, timesheets cannot be modified.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs md:text-sm font-bold text-slate-500 whitespace-nowrap">Status</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 md:px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
                    >
                        <option value="All">All</option>
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending</option>
                        <option value="Approved">Approved</option>
                        <option value="Rejected">Rejected</option>
                    </select>
                </div>
            </div>

            {/* Summary List */}
            <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-0">
                {filteredWeeks.map((week, index) => (
                    <div
                        key={index}
                        className="group bg-white rounded-xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all duration-300 overflow-hidden cursor-pointer"
                        onClick={() => onSelectWeek(week)}
                    >
                        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-100">
                            {/* Week Info */}
                            <div className="py-3 px-4 md:py-3 md:px-5 flex-1 min-w-full md:min-w-[260px] lg:min-w-[300px] relative">
                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${week.status === 'Approved' ? 'bg-emerald-500' : week.status === 'Rejected' ? 'bg-red-500' : week.status === 'Draft' ? 'bg-slate-400' : 'bg-amber-500'}`}></div>
                                <h3 className="text-indigo-600 font-bold hover:underline text-sm md:text-base whitespace-nowrap">
                                    {week.startDate} To {week.endDate}
                                </h3>
                                <p className={`text-[10px] md:text-xs font-black uppercase tracking-widest mt-1.5 ${week.status === 'Approved' ? 'text-emerald-600' : week.status === 'Rejected' ? 'text-red-600' : week.status === 'Draft' ? 'text-slate-500' : 'text-amber-600'}`}>
                                    {week.status}
                                </p>
                            </div>
 
                            {/* Stats */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 flex-[3] w-full bg-slate-50/50">
                                <div className="py-2.5 px-3 md:py-3 md:px-4 flex flex-col items-center justify-center text-center border-r md:border-r-0 lg:border-r border-slate-100">
                                    <span className="text-sm md:text-lg font-bold text-slate-700">{week.billableHrs.toFixed(2)}</span>
                                    <span className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400">Billable Project</span>
                                </div>
                                <div className="py-2.5 px-3 md:py-3 md:px-4 flex flex-col items-center justify-center text-center">
                                    <span className="text-sm md:text-lg font-bold text-slate-700">{week.nonBillableHrs.toFixed(2)}</span>
                                    <span className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400">Non-Billable</span>
                                </div>
                                <div className="py-2.5 px-3 md:py-3 md:px-4 flex flex-col items-center justify-center text-center border-t lg:border-t-0 border-r lg:border-l border-slate-100">
                                    <span className="text-sm md:text-lg font-bold text-slate-700">{week.timeOffHrs.toFixed(2)}</span>
                                    <span className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400">Time Off/Holiday</span>
                                </div>
                                <div className="py-2.5 px-3 md:py-3 md:px-4 flex flex-col items-center justify-center text-center border-t lg:border-t-0 lg:border-l border-slate-100">
                                    <span className="text-sm md:text-lg font-bold text-slate-700">
                                        {(week.billableHrs + week.nonBillableHrs + week.timeOffHrs).toFixed(2)}
                                    </span>
                                    <span className="text-[9px] md:text-[10px] uppercase font-bold text-slate-400 font-black text-indigo-600/40">Total Hours</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {filteredWeeks.length === 0 && (
                    <div className="bg-white p-20 rounded-2xl border-2 border-dashed border-slate-200 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h4 className="text-lg font-bold text-slate-400">No timesheets found</h4>
                        <p className="text-slate-400 mt-1">Start by filling your first weekly timesheet</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TimesheetSummary;
