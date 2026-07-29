import React, { useEffect, useState } from "react";
import useEmployees from "../hooks/useEmployees";
import api from "../utils/api";
import DisabledBadge from "./DisabledBadge";
import { isDisabled } from "../utils/employeeStatus";

export default function EmployeeSelectorModal({ open, onClose, onSave }) {
  const [employees, setEmployees] = useState([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState({});
  const [managerId, setManagerId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [existingManagers, setExistingManagers] = useState(new Set());
  const [assignedEmployees, setAssignedEmployees] = useState(new Set());

  const { employees: fetchedEmployees } = useEmployees();

  useEffect(() => {
    if (!open) return;

    if (fetchedEmployees && fetchedEmployees.length) {
      const list = fetchedEmployees
        .filter(e => {
          const isSystemAdmin = (e.role === 'ADMIN') || (e.firstName === 'System' && e.lastName === 'Admin');
          const isHR = (e.role === 'HR');
          return !isSystemAdmin && !isHR;
        })
        .map((e) => ({
          id: e.id,
          name: `${e.firstName || ""}${e.lastName ? ` ${e.lastName}` : ""}`.trim(),
          email: e.email || "",
          corporateEmail: e.corporateEmail,
          active: e.active,
        }));
      setEmployees(list);
    } else {
      setEmployees([]);
    }

    // Fetch existing managers to exclude them
    api("/api/reporting-managers")
      .then(res => res.json())
      .then(data => {
        const set = new Set();
        if (Array.isArray(data)) {
          data.forEach(m => set.add(m.id));
        }
        setExistingManagers(set);
      })
      .catch(err => console.error("Failed to fetch existing managers", err));

    // Fetch all assignments to find currently assigned employees
    api("/api/reporting-managers/assignments")
      .then(res => res.json())
      .then(data => {
        const set = new Set();
        if (Array.isArray(data)) {
          data.forEach(a => {
            // If employee has a manager, they are assigned. 
            // Note: Data is EmployeeReportingDTO { employeeId, reportingManagerId, ... }
            if (a.reportingManagerId) {
              set.add(a.employeeId);
            }
          });
        }
        setAssignedEmployees(set);
      })
      .catch(err => console.error("Failed to fetch assignments", err));

  }, [open, fetchedEmployees]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelected({});
      setManagerId(null);
    }
  }, [open]);

  // Clear selection when manager changes to prevent bleed-over
  const handleManagerChange = (e) => {
    const val = e.target.value ? Number(e.target.value) : null;
    setManagerId(val);
    setSelected({}); // RESET selected team when manager changes
  };

  const toggleSelect = (id) => setSelected((p) => ({ ...p, [id]: !p[id] }));

  // FILTER LOGIC:
  // 1. Must match search query
  // 2. Must NOT be an existing manager (cannot report to someone else if they are a manager? - assuming simple hierarchy for now or per requirement)
  // 3. Must NOT be already assigned to another manager (unless they are selected in THIS session, unlikely for new assignment)
  // 4. Must NOT be the currently selected manager (cannot report to self)
  // Actually, we want to hide "Assigned" employees from the list so they can't be picked.
  const filtered = employees.filter((e) =>
    (e.name.toLowerCase().includes(query.toLowerCase()) ||
      (e.email || "").toLowerCase().includes(query.toLowerCase())) &&
    !existingManagers.has(e.id) &&
    !assignedEmployees.has(e.id) && // Hide assigned employees
    e.id !== managerId // Hide the selected manager themselves
  );

  const filteredTeam = filtered; // No need to filter managerId again if we did it above

  const handleSave = async () => {
    const team = employees.filter((e) => selected[e.id]);
    const manager = employees.find((e) => e.id === managerId) || null;
    const payload = { manager, team };

    if (!manager) {
      alert('Please select a reporting manager');
      return;
    }

    if (team.length === 0) {
      alert('Please select at least one team member');
      return;
    }

    setSaving(true);

    // REMOVED LOCAL STORAGE SAVING
    // try { localStorage.setItem("selectedReportingManagers", JSON.stringify(payload)); }
    // catch (e) { console.error("Failed to persist selected employees", e); }

    // POST each assignment to backend
    for (const emp of team) {
      try {
        const res = await api('/api/reporting-managers', {
          method: 'POST',
          body: JSON.stringify({
            employeeId: emp.id,
            reportingManagerId: manager.id,
            hrId: null,
          }),
        });
        const text = await res.text().catch(() => null);
        if (!res.ok) {
          console.error(`Failed to save assignment for employee ${emp.id}`, res.status, text);
        } else {
          console.log(`Saved assignment for employee ${emp.id}`, text);
        }
      } catch (e) {
        console.error(`Error saving assignment for employee ${emp.id}:`, e);
      }
    }

    setSaving(false);
    alert('Reporting manager assignments saved successfully!');
    // Clear State
    setSelected({});
    setManagerId(null);
    localStorage.removeItem("selectedReportingManagers"); // Explicitly clear if it exists

    if (onSave) onSave(payload);
    onClose();
  };

  if (!open) return null;

  // Calculate if save should be enabled
  const teamSize = Object.values(selected).filter(Boolean).length;
  const isSaveDisabled = saving || !managerId || teamSize === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />

      <div className="bg-white rounded-xl shadow-lg w-11/12 max-w-2xl p-6 relative z-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Assign Reporting Manager & Team</h3>
          <button className="text-gray-600" onClick={onClose}>✕</button>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Select Manager</label>
          <select
            value={managerId || ""}
            onChange={handleManagerChange}
            className="w-full border rounded-md p-2"
          >
            <option value="">-- Select manager --</option>
            {employees
              .filter(emp => !existingManagers.has(emp.id)) // Managers can't be assigned as managers? Or circular? Just following existing logic.
              .map((emp) => (
                // Disabled employees cannot be assigned as a reporting manager.
                <option key={emp.id} value={emp.id} disabled={isDisabled(emp)}>{emp.name}{isDisabled(emp) ? " — DISABLED" : ""}{emp.corporateEmail ? ` (${emp.corporateEmail})` : " (Not Available)"}</option>
              ))}
          </select>
        </div>

        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search team members by name or email"
            className="w-full border rounded-md p-2"
          />
        </div>

        <div className="max-h-64 overflow-y-auto mb-4">
          {filteredTeam.length === 0 && (<p className="text-sm text-gray-500">No available team members found</p>)}
          {filteredTeam.map((emp) => {
            const empDisabled = isDisabled(emp);
            return (
            <label key={emp.id} className={`flex items-center gap-3 p-2 rounded ${empDisabled ? 'bg-[#F1EFE8] cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}>
              {/* Disabled employees are shown but cannot be assigned — checkbox is disabled. */}
              <input type="checkbox" checked={!empDisabled && !!selected[emp.id]} disabled={empDisabled} onChange={() => !empDisabled && toggleSelect(emp.id)} className="w-4 h-4" />
              <div>
                <div className="flex items-center gap-2">
                  <div className={`font-medium ${empDisabled ? 'text-[#5F5E5A]' : ''}`}>{emp.name}</div>
                  {empDisabled && <DisabledBadge />}
                </div>
                <div className="text-sm text-gray-500">{emp.corporateEmail || "Not Available"}</div>
              </div>
            </label>
            );
          })}
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-200">Cancel</button>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
