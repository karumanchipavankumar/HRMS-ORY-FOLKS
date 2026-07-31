package com.hrms.service;

import com.hrms.dto.EmployeeSimpleDTO;
import com.hrms.dto.ManagerDetailsDTO;
import com.hrms.dto.ManagerSummaryDTO;
import com.hrms.dto.EmployeeReportingRequest;
import com.hrms.model.Employee;
import com.hrms.model.EmployeeReporting;
import com.hrms.model.User;
import com.hrms.model.Role;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import com.hrms.dto.EmployeeReportingDTO;
import com.hrms.model.CompanyDetail;

@Service
@RequiredArgsConstructor
public class EmployeeReportingService {

    private final EmployeeReportingRepository repository;
    private final EmployeeRepository employeeRepository;
    private final UserRepository userRepository;
    private final CompanyDetailRepository companyDetailRepository;

    public List<ManagerSummaryDTO> listManagers() {
        // List<Employee> managers = repository.findDistinctReportingManagers();
        List<Employee> managers = employeeRepository.findByUser_Role(Role.REPORTING_MANAGER);
        Map<Long, String> corporateEmailMap = companyDetailRepository.findAll().stream()
                .filter(cd -> cd.getOryfolksMailId() != null)
                .collect(Collectors.toMap(cd -> cd.getEmployee().getId(), CompanyDetail::getOryfolksMailId,
                        (a, b) -> a));

        return managers.stream()
                .map(m -> new ManagerSummaryDTO(m.getId(),
                        formatEmployeeName(m),
                        m.getEmail(),
                        corporateEmailMap.get(m.getId()),
                        m.getActive()))
                .collect(Collectors.toList());
    }

    public Employee promoteToManager(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee != null && employee.getUser() != null) {
            User u = employee.getUser();
            if (u.getRole() != Role.REPORTING_MANAGER) {
                u.setRole(Role.REPORTING_MANAGER);
                userRepository.save(u);

                // Sync the relationships according to the role rules
                syncReportingRelationshipsForEmployee(employee);
            }
            return employee;
        }
        return null;
    }

    public Employee promoteToHR(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId).orElse(null);
        if (employee != null && employee.getUser() != null) {
            User u = employee.getUser();
            if (u.getRole() != Role.HR) {
                u.setRole(Role.HR);
                userRepository.save(u);

                // Sync the relationships according to the role rules
                syncReportingRelationshipsForEmployee(employee);
            }
            return employee;
        }
        return null;
    }

    public List<EmployeeReportingDTO> listAllAssignments() {
        // Sync reporting relationships for all employees before loading to ensure consistency
        List<Employee> allEmployees = employeeRepository.findAll();
        for (Employee emp : allEmployees) {
            try {
                syncReportingRelationshipsForEmployee(emp);
            } catch (Exception e) {
                System.err.println("Error syncing relationships for employee: " + emp.getId() + ", " + e.getMessage());
            }
        }

        List<EmployeeReporting> items = repository.findAll();
        return items.stream().map(er -> {
            Long empId = er.getEmployee() != null ? er.getEmployee().getId() : null;
            Long mgrId = er.getReportingManager() != null ? er.getReportingManager().getId() : null;
            String mgrName = er.getReportingManager() != null ? formatEmployeeName(er.getReportingManager()) : null;
            String mgrEmail = er.getReportingManager() != null ? er.getReportingManager().getEmail() : null;
            String mgrRole = null;
            if (er.getReportingManager() != null && er.getReportingManager().getUser() != null) {
                mgrRole = er.getReportingManager().getUser().getRole() != null
                        ? er.getReportingManager().getUser().getRole().name()
                        : null;
            }
            Long hrId = er.getHr() != null ? er.getHr().getId() : null;
            String hrName = er.getHr() != null ? formatEmployeeName(er.getHr()) : null;
            String hrRole = null;
            if (er.getHr() != null && er.getHr().getUser() != null) {
                hrRole = er.getHr().getUser().getRole() != null ? er.getHr().getUser().getRole().name() : null;
            }

            String mgrCorpEmail = er.getReportingManager() != null
                    ? companyDetailRepository.findByEmployee_Id(er.getReportingManager().getId())
                            .map(CompanyDetail::getOryfolksMailId).orElse(null)
                    : null;

            EmployeeReportingDTO dto = new EmployeeReportingDTO(empId, mgrId, mgrName, mgrEmail, mgrCorpEmail, hrId,
                    hrName);
            dto.setReportingManagerRole(mgrRole);
            dto.setHrRole(hrRole);
            return dto;
        }).collect(Collectors.toList());
    }

    /**
     * Builds the "HR Team & Assigned Employees" view for the Admin Dashboard: every HR
     * user with the list of employees assigned to them (via EmployeeReporting.hr). Mirrors
     * the Reporting Manager team data, but keyed on the HR relationship. Read-only — does
     * not alter any assignment or approval state.
     */
    public List<Map<String, Object>> listHrTeams() {
        List<Employee> hrEmployees = employeeRepository.findByUser_Role(Role.HR);
        List<Map<String, Object>> result = new java.util.ArrayList<>();

        for (Employee hr : hrEmployees) {
            CompanyDetail hrCd = companyDetailRepository.findByEmployee_Id(hr.getId()).orElse(null);

            Map<String, Object> hrMap = new java.util.LinkedHashMap<>();
            hrMap.put("hrEmployeeId", hr.getId()); // internal id (stable key for the UI)
            hrMap.put("hrId", hrCd != null && hrCd.getOryfolksId() != null ? hrCd.getOryfolksId()
                    : String.valueOf(hr.getId()));
            hrMap.put("hrName", (hr.getFirstName() + " " + (hr.getLastName() == null ? "" : hr.getLastName())).trim());
            hrMap.put("designation", hrCd != null && hrCd.getDesignation() != null ? hrCd.getDesignation() : "HR");
            hrMap.put("status", Boolean.FALSE.equals(hr.getActive()) ? "INACTIVE" : "ACTIVE");

            List<Map<String, Object>> assignedEmployees = new java.util.ArrayList<>();
            for (EmployeeReporting er : repository.findByHr(hr)) {
                Employee e = er.getEmployee();
                if (e == null)
                    continue;
                CompanyDetail cd = companyDetailRepository.findByEmployee_Id(e.getId()).orElse(null);
                Map<String, Object> empMap = new java.util.LinkedHashMap<>();
                empMap.put("employeeId", cd != null && cd.getOryfolksId() != null ? cd.getOryfolksId()
                        : String.valueOf(e.getId()));
                empMap.put("employeeName",
                        (e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName())).trim());
                empMap.put("designation", cd != null && cd.getDesignation() != null ? cd.getDesignation() : "Employee");
                empMap.put("status", Boolean.FALSE.equals(e.getActive()) ? "INACTIVE" : "ACTIVE");
                assignedEmployees.add(empMap);
            }

            hrMap.put("assignedEmployees", assignedEmployees);
            hrMap.put("totalAssigned", assignedEmployees.size());
            result.add(hrMap);
        }

        return result;
    }

    public ManagerDetailsDTO getManagerDetails(Long managerId) {
        List<EmployeeReporting> items = repository.findAllByReportingManager_Id(managerId);
        if (items == null)
            items = java.util.Collections.emptyList();

        // Find manager employee object
        Employee manager = employeeRepository.findById(managerId).orElse(null);

        // Collect all IDs (manager + team) to fetch corporate emails in bulk
        java.util.Set<Long> allIds = new java.util.HashSet<>();
        if (managerId != null)
            allIds.add(managerId);
        for (EmployeeReporting er : items) {
            if (er.getEmployee() != null)
                allIds.add(er.getEmployee().getId());
        }

        // Fetch all relevant company details in one go
        Map<Long, CompanyDetail> companyDetailsMap = companyDetailRepository.findByEmployee_IdIn(allIds).stream()
                .filter(cd -> cd.getEmployee() != null)
                .collect(Collectors.toMap(cd -> cd.getEmployee().getId(), cd -> cd,
                        (a, b) -> a));

        List<EmployeeSimpleDTO> teamWithCorp = items.stream()
                .map(er -> er.getEmployee())
                .filter(e -> e != null)
                .map(e -> {
                    CompanyDetail cd = companyDetailsMap.get(e.getId());
                    String corpEmail = cd != null ? cd.getOryfolksMailId() : null;
                    String oryfolksId = cd != null ? cd.getOryfolksId() : null;
                    return new EmployeeSimpleDTO(e.getId(),
                            formatEmployeeName(e),
                            e.getEmail(),
                            corpEmail,
                            oryfolksId,
                            e.getActive());
                })
                .collect(Collectors.toList());

        String fullName = manager != null ? formatEmployeeName(manager) : "";
        String email = manager != null ? manager.getEmail() : "";
        CompanyDetail managerCd = companyDetailsMap.get(managerId);
        String corporateEmail = managerCd != null ? managerCd.getOryfolksMailId() : null;

        return new ManagerDetailsDTO(managerId, fullName, email, corporateEmail, teamWithCorp);
    }

    public List<EmployeeSimpleDTO> getAvailableEmployees() {
        List<Employee> employees = employeeRepository.findByUser_Role(Role.EMPLOYEE);
        return employees.stream()
                .filter(e -> e.getUser() != null && e.getUser().getRole() == Role.EMPLOYEE) // Double check it's only
                                                                                            // employees
                .map(e -> {
                    CompanyDetail cd = companyDetailRepository.findByEmployee_Id(e.getId()).orElse(null);
                    String corpEmail = cd != null ? cd.getOryfolksMailId() : null;
                    String oryfolksId = cd != null ? cd.getOryfolksId() : null;
                    return new EmployeeSimpleDTO(e.getId(),
                            e.getFirstName() + " " + (e.getLastName() == null ? "" : e.getLastName()),
                            e.getEmail(),
                            corpEmail,
                            oryfolksId,
                            e.getActive());
                })
                .collect(Collectors.toList());
    }

    public EmployeeReporting createOrUpdate(EmployeeReportingRequest req) {
        if (req == null || req.getEmployeeId() == null)
            return null;

        Employee employee = employeeRepository.findById(req.getEmployeeId()).orElse(null);
        if (employee == null)
            return null;

        EmployeeReporting er = repository.findByEmployee(employee).orElse(null);
        if (er == null)
            er = new EmployeeReporting();

        er.setEmployee(employee);

        if (req.getReportingManagerId() != null) {
            Employee mgr = employeeRepository.findById(req.getReportingManagerId()).orElse(null);
            er.setReportingManager(mgr);
            // promote manager's user role to REPORTING_MANAGER if currently EMPLOYEE
            if (mgr != null && mgr.getUser() != null) {
                User u = mgr.getUser();
                if (u.getRole() == Role.EMPLOYEE) {
                    u.setRole(Role.REPORTING_MANAGER);
                    userRepository.save(u);
                    // Ensure this new manager reports to Admin
                    syncReportingRelationshipsForEmployee(mgr);
                }
            }
        } else {
            er.setReportingManager(null);
        }

        if (req.getHrId() != null) {
            Employee hr = employeeRepository.findById(req.getHrId()).orElse(null);
            er.setHr(hr);
            // promote HR's user role to HR if currently EMPLOYEE
            if (hr != null && hr.getUser() != null) {
                User u = hr.getUser();
                if (u.getRole() == Role.EMPLOYEE) {
                    u.setRole(Role.HR);
                    userRepository.save(u);
                    // Ensure this new HR reports to Admin
                    syncReportingRelationshipsForEmployee(hr);
                }
            }
        } else {
            er.setHr(null);
        }

        EmployeeReporting saved = repository.save(er);
        syncReportingRelationshipsForEmployee(employee);
        return saved;
    }

    @org.springframework.transaction.annotation.Transactional
    public void removeManager(Long managerId) {
        System.out.println("Attempting to remove manager with ID: " + managerId);

        // Use explicit fresh fetch
        Employee manager = employeeRepository.findById(managerId)
                .orElseThrow(() -> new RuntimeException("Manager not found"));

        // 1. Demote User Role
        if (manager.getUser() != null) {
            // Fetch User explicitly to ensure it is attached
            User u = userRepository.findById(manager.getUser().getId())
                    .orElseThrow(() -> new RuntimeException("User not found"));
            System.out.println("Found user: " + u.getId() + ", Current Role: " + u.getRole());

            if (u.getRole() == Role.REPORTING_MANAGER) {
                u.setRole(Role.EMPLOYEE);
                userRepository.saveAndFlush(u); // Flush to force DB update
                System.out.println("Demoted user to EMPLOYEE");
            }
        }

        // NEW: Revert to previous reporting manager
        EmployeeReporting employeeReporting = repository.findByEmployee(manager).orElse(null);
        if (employeeReporting != null) {
            if (employeeReporting.getPreviousReportingManager() != null) {
                employeeReporting.setReportingManager(employeeReporting.getPreviousReportingManager());
                employeeReporting.setPreviousReportingManager(null); // Clear history
                System.out.println("Reverted to previous manager: " + employeeReporting.getReportingManager().getId());
            } else {
                employeeReporting.setReportingManager(null); // No previous manager, set to null
                System.out.println("No previous manager, cleared reporting manager");
            }
            repository.save(employeeReporting);
        }

        // 2. Unassign all team members
        List<EmployeeReporting> team = repository.findAllByReportingManager_Id(managerId);
        System.out.println("Found " + team.size() + " team members");

        for (EmployeeReporting teamMemberEr : team) {
            teamMemberEr.setReportingManager(null);
            repository.save(teamMemberEr);
        }
        repository.flush(); // Flush updates
        System.out.println("Unassigned team members");
    }

    @org.springframework.transaction.annotation.Transactional
    public void removeTeamMember(Long employeeId) {
        System.out.println("Attempting to unassign team member with ID: " + employeeId);
        EmployeeReporting er = repository.findByEmployee_Id(employeeId).orElse(null);
        if (er != null) {
            er.setReportingManager(null);
            repository.save(er);
            repository.flush();
            System.out.println("Unassigned employee " + employeeId);
        } else {
            System.out.println("EmployeeReporting record not found for employee " + employeeId);
        }
    }

    public Employee getFirstActiveHR() {
        List<Employee> hrs = employeeRepository.findByUser_Role(Role.HR);
        if (hrs == null || hrs.isEmpty()) return null;
        return hrs.stream()
                .filter(e -> Boolean.TRUE.equals(e.getActive()) && e.getUser() != null && Boolean.TRUE.equals(e.getUser().getActive()))
                .findFirst()
                .orElse(hrs.stream()
                        .filter(e -> Boolean.TRUE.equals(e.getActive()))
                        .findFirst()
                        .orElse(hrs.get(0)));
    }

    public Employee getFirstActiveAdmin() {
        List<Employee> admins = employeeRepository.findByUser_Role(Role.ADMIN);
        if (admins == null || admins.isEmpty()) return null;
        return admins.stream()
                .filter(e -> Boolean.TRUE.equals(e.getActive()) && e.getUser() != null && Boolean.TRUE.equals(e.getUser().getActive()))
                .findFirst()
                .orElse(admins.stream()
                        .filter(e -> Boolean.TRUE.equals(e.getActive()))
                        .findFirst()
                        .orElse(admins.get(0)));
    }

    public void syncReportingRelationshipsForEmployee(Employee employee) {
        if (employee == null) return;

        Role role = Role.EMPLOYEE;
        if (employee.getUser() != null && employee.getUser().getRole() != null) {
            role = employee.getUser().getRole();
        }

        if (role == Role.ADMIN) {
            return;
        }

        EmployeeReporting er = repository.findByEmployee(employee).orElse(null);
        if (er == null) {
            er = new EmployeeReporting();
            er.setEmployee(employee);
        }

        Employee firstActiveHR = getFirstActiveHR();
        Employee firstActiveAdmin = getFirstActiveAdmin();

        boolean updated = false;

        if (role == Role.REPORTING_MANAGER) {
            if (firstActiveHR != null) {
                if (er.getHr() == null) {
                    er.setHr(firstActiveHR);
                    updated = true;
                }
                if (er.getReportingManager() == null || !er.getReportingManager().getId().equals(er.getHr().getId())) {
                    er.setReportingManager(er.getHr());
                    updated = true;
                }
            }
        } else if (role == Role.HR) {
            if (firstActiveAdmin != null) {
                if (er.getReportingManager() == null || !er.getReportingManager().getId().equals(firstActiveAdmin.getId())) {
                    er.setReportingManager(firstActiveAdmin);
                    updated = true;
                }
                if (er.getHr() == null || !er.getHr().getId().equals(firstActiveAdmin.getId())) {
                    er.setHr(firstActiveAdmin);
                    updated = true;
                }
            }
        } else if (role == Role.EMPLOYEE) {
            if (firstActiveHR != null) {
                if (er.getHr() == null) {
                    er.setHr(firstActiveHR);
                    updated = true;
                }
            }
        }

        if (updated || er.getId() == null) {
            repository.save(er);
            repository.flush();
        }
    }

    private String formatEmployeeName(Employee e) {
        if (e == null) return null;
        String first = e.getFirstName() != null ? e.getFirstName().trim() : "";
        String last = e.getLastName() != null ? e.getLastName().trim() : "";
        if ("admin".equalsIgnoreCase(last)) {
            return first;
        }
        return (first + " " + last).trim();
    }
}
