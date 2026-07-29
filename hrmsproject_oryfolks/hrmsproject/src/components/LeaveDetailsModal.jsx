import React from 'react';

const LeaveDetailsModal = ({ isOpen, onClose, leave }) => {
    if (!isOpen || !leave) return null;

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return "N/A";
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB') + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusStyle = (status) => {
        switch (status?.toUpperCase()) {
            case 'APPROVED': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
            case 'PENDING': return 'bg-brand-yellow/10 text-brand-yellow-dark border-brand-yellow/20';
            case 'REJECTED': return 'bg-red-50 text-red-600 border-red-100';
            default: return 'bg-gray-50 text-gray-600 border-gray-100';
        }
    };

    // Consistent label/value field used throughout the modal for aligned sections
    const Field = ({ label, children }) => (
        <div className="space-y-1.5 min-w-0">
            <label className="block text-[9px] font-black text-brand-blue/30 uppercase tracking-[0.2em]">{label}</label>
            <div className="text-sm font-bold text-brand-blue/80 break-words">{children}</div>
        </div>
    );

    const initials = (leave.employeeName || "U")
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("");

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-brand-blue/40 backdrop-blur-sm" onClick={onClose}></div>

            <div className="relative bg-white w-full max-w-lg rounded-[2rem] shadow-2xl border border-brand-blue/5 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-brand-blue p-5 md:p-6 md:px-8 flex justify-between items-center gap-4 text-white shrink-0">
                    <div className="min-w-0">
                        <h3 className="text-lg md:text-xl font-black tracking-tight uppercase truncate">Leave Details</h3>
                        <p className="text-[9px] md:text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mt-1">Application Information</p>
                    </div>
                    <button onClick={onClose} aria-label="Close" className="shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all">
                        <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Disabled-account banner — shown when the leave belongs to a disabled employee.
                    The record is read-only; no actions can be taken. */}
                {(leave.employeeStatus === 'INACTIVE' || leave.employeeStatus === 'DISABLED') && (
                    <div className="flex items-start gap-2 bg-[#F1EFE8] text-[#5F5E5A] text-[13px] px-5 md:px-8 py-3 border-b border-[#D3D1C7] shrink-0">
                        <span className="mt-px">⚠</span>
                        <span>This employee's account has been disabled. Records are visible for reference only. No actions can be taken.</span>
                    </div>
                )}

                <div className="p-5 md:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Employee Information */}
                    <div className="flex items-center gap-4 bg-bg-slate p-4 sm:p-5 rounded-2xl border border-brand-blue/5 shadow-inner">
                        <div className="shrink-0 w-12 h-12 rounded-xl bg-brand-blue text-white flex items-center justify-center text-sm font-black uppercase shadow-md">
                            {initials || "U"}
                        </div>
                        <div className="min-w-0 flex-1">
                            <label className="block text-[9px] font-black text-brand-blue/30 uppercase tracking-[0.2em]">Employee</label>
                            <p className="text-sm font-black text-brand-blue uppercase truncate">{leave.employeeName || "—"}</p>
                            {(leave.employeeId != null) && (
                                <p className="text-[10px] font-bold text-brand-blue/40 tracking-wide mt-0.5">ID: {leave.oryfolksId || leave.employeeId}</p>
                            )}
                        </div>
                        <span className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest border shadow-sm ${getStatusStyle(leave.status)}`}>
                            {leave.status}
                        </span>
                    </div>

                    {/* Leave Information */}
                    <div className="px-4 grid grid-cols-2 gap-x-6 gap-y-5">
                        <Field label="Leave Type">
                            <span className="uppercase">{leave.leaveType || "—"}</span>
                        </Field>
                        <Field label="Total Duration">
                            <span>
                                {(leave.daysCount || 0).toFixed(1)}
                                <span className="text-[10px] font-bold text-brand-blue/40 uppercase ml-1">Days</span>
                            </span>
                        </Field>
                    </div>

                    {/* Leave Dates */}
                    <div className="px-4 grid grid-cols-2 gap-x-6 gap-y-5 pt-5 border-t border-brand-blue/5">
                        <Field label="Start Date">
                            <span className="text-[11px] font-bold text-brand-blue/70">{formatDate(leave.startDate)}</span>
                        </Field>
                        <Field label="End Date">
                            <span className="text-[11px] font-bold text-brand-blue/70">{formatDate(leave.endDate)}</span>
                        </Field>
                    </div>

                    {/* Daily Breakdown */}
                    {leave.sessionData && Object.keys(leave.sessionData).length > 0 && (
                        <div className="bg-bg-slate/40 rounded-2xl p-4 border border-brand-blue/5">
                            <label className="text-[9px] font-black text-brand-blue/30 uppercase tracking-[0.2em] mb-3 block">Daily Breakdown</label>
                            <div className="space-y-2">
                                {Object.entries(leave.sessionData).map(([date, session]) => (
                                    <div key={date} className="flex justify-between items-center gap-3 px-3 py-2 bg-white rounded-xl border border-brand-blue/5 shadow-sm">
                                        <span className="text-[10px] font-bold text-brand-blue/60 truncate">{formatDate(date)}</span>
                                        <span className={`shrink-0 text-[9px] font-black uppercase px-2 py-0.5 rounded ${session === 'FULL' ? 'bg-brand-blue/5 text-brand-blue' :
                                            session === 'MORNING' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'
                                            }`}>{session === 'FULL' ? 'Full Day' : session}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div className="bg-bg-slate p-4 sm:p-5 rounded-2xl border border-brand-blue/5 shadow-inner">
                        <label className="text-[9px] font-black text-brand-blue/30 uppercase tracking-[0.2em] mb-2 block">Reason</label>
                        <p className="text-xs font-bold text-brand-blue/60 leading-relaxed italic break-words">
                            {leave.reason ? `"${leave.reason}"` : "No reason provided."}
                        </p>
                    </div>

                    {/* Decision Information */}
                    {leave.status !== 'PENDING' && (
                        <div className="bg-indigo-50/30 p-4 sm:p-5 rounded-2xl border border-indigo-100/50">
                            <label className="text-[9px] font-black text-indigo-600/50 uppercase tracking-[0.2em] mb-3 block">Decision Information</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                                <div className="space-y-1 min-w-0">
                                    <label className="block text-[9px] font-black text-indigo-600/40 uppercase tracking-[0.2em]">Processed By</label>
                                    <p className="text-[11px] font-black text-indigo-900 break-words">{leave.approvedBy || "System"}</p>
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <label className="block text-[9px] font-black text-indigo-600/40 uppercase tracking-[0.2em]">Reviewed At</label>
                                    <p className="text-[11px] font-black text-indigo-900 break-words">{formatDateTime(leave.reviewedAt)}</p>
                                </div>
                            </div>
                            {leave.status === 'REJECTED' && leave.rejectionReason && (
                                <div className="mt-4 pt-4 border-t border-indigo-100/50">
                                    <label className="text-[9px] font-black text-red-500/50 uppercase tracking-[0.2em] mb-1 block">Rejection Note</label>
                                    <p className="text-[11px] font-bold text-red-600 italic break-words">"{leave.rejectionReason}"</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Remaining Balances Section */}
                    <div className="bg-emerald-50/30 p-4 sm:p-6 rounded-2xl border border-emerald-100/50">
                        <h4 className="text-[10px] font-black text-emerald-600/60 uppercase tracking-[0.2em] mb-4">Post-Request Balances</h4>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Casual', value: leave.casualLeavesRemaining },
                                { label: 'Sick', value: leave.sickLeavesRemaining },
                                { label: 'Earned', value: leave.earnedLeavesRemaining }
                            ].map((bal, idx) => (
                                <div key={idx} className="bg-white p-3 rounded-xl border border-emerald-100 flex flex-col items-center text-center">
                                    <span className="text-[8px] font-black text-emerald-600/40 uppercase tracking-widest">{bal.label}</span>
                                    <span className="text-sm font-black text-emerald-800 mt-0.5">{(bal.value || 0).toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LeaveDetailsModal;
