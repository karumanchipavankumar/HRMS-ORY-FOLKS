import React from "react";

/**
 * UnsavedChangesModal
 * Reusable modal dialog for intercepting navigation when a form has unsaved changes.
 * 
 * Props:
 *  - isOpen (boolean): controls modal visibility
 *  - onClose (function): called when user clicks Cancel
 *  - onSave (function): called when user clicks Save
 *  - onDiscard (function): called when user clicks Leave/Discard
 *  - isSaving (boolean): loading state while saving
 */
export default function UnsavedChangesModal({ isOpen, onClose, onSave, onDiscard, isSaving }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Modal Backdrop */}
      <div 
        className="absolute inset-0 bg-brand-blue/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-brand-blue/10 overflow-hidden p-6 md:p-8 animate-in zoom-in-95 duration-200 z-10">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-black text-brand-blue tracking-tight">Unsaved Changes</h3>
            <p className="text-sm font-medium text-brand-blue/70 mt-2 leading-relaxed">
              You have unsaved changes. If you leave now, your changes will be lost. Save your changes to keep them, or click Cancel to return.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-brand-blue/10 text-brand-blue/70 font-bold text-xs uppercase tracking-wider hover:bg-bg-slate transition-all disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onDiscard}
            className="px-5 py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
          >
            Leave
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onSave}
            className="px-5 py-2.5 rounded-xl bg-brand-yellow text-brand-blue font-black text-xs uppercase tracking-wider shadow-md hover:shadow-lg hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-brand-blue border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
