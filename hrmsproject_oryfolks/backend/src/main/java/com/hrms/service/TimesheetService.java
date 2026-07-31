package com.hrms.service;

import com.hrms.dto.TimesheetDTO;
import com.hrms.model.Employee;
import com.hrms.model.Timesheet;
import com.hrms.model.TimesheetStatus;
import com.hrms.model.User;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.TimesheetRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.model.EmployeeReporting;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.model.CompanyDetail;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Duration;
import java.util.List;
import java.util.stream.Collectors;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

@Service
@Transactional
public class TimesheetService {

    @Autowired
    private TimesheetRepository timesheetRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmployeeReportingRepository employeeReportingRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    @PersistenceContext
    private EntityManager entityManager;

    public List<TimesheetDTO> getAllTimesheets(Long employeeId, LocalDate fromDate, LocalDate toDate,
            String status, Integer page, Integer size) {
        // Backward-compatible overload — aggregate/manager views never expose drafts.
        return getAllTimesheets(employeeId, fromDate, toDate, status, page, size, false);
    }

    public List<TimesheetDTO> getAllTimesheets(Long employeeId, LocalDate fromDate, LocalDate toDate,
            String status, Integer page, Integer size, boolean includeDrafts) {
        TimesheetStatus statusEnum = status != null ? TimesheetStatus.valueOf(status.toUpperCase()) : null;

        List<Timesheet> timesheets;
        if (employeeId != null || fromDate != null || toDate != null || statusEnum != null) {
            timesheets = timesheetRepository.findWithFilters(employeeId, fromDate, toDate, statusEnum);
        } else {
            timesheets = timesheetRepository.findAll();
        }

        return timesheets.stream()
                // DRAFT timesheets are private to the owning employee's editing view. They must never
                // surface in approval queues, admin/HR/RM aggregates or downloads, so unless the caller
                // explicitly opts in (its own personal view) we drop them here.
                .filter(t -> includeDrafts || t.getStatus() != TimesheetStatus.DRAFT)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public TimesheetDTO getTimesheetById(Long id) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));
        return convertToDTO(timesheet);
    }

    public TimesheetDTO createTimesheet(TimesheetDTO dto) {
        Employee employee = employeeRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        if ("PROJECT".equalsIgnoreCase(dto.getCategory())) {
            if (dto.getProject() == null || dto.getProject().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project ID is mandatory for project rows.");
            }
            if (dto.getProjectName() == null || dto.getProjectName().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project Name is mandatory for project rows.");
            }
        }

        Timesheet timesheet = new Timesheet();
        timesheet.setEmployee(employee);
        timesheet.setDate(dto.getDate());
        timesheet.setStartTime(dto.getStartTime());
        timesheet.setEndTime(dto.getEndTime());
        timesheet.setProject(dto.getProject());
        timesheet.setTask(dto.getTask());
        timesheet.setNotes(dto.getNotes());
        timesheet.setStatus(TimesheetStatus.PENDING);

        timesheet.setOnsiteOffshore(dto.getOnsiteOffshore());
        timesheet.setBillingLocation(dto.getBillingLocation());
        timesheet.setBillable(dto.getBillable());
        timesheet.setProjectName(dto.getProjectName());
        timesheet.setTaskDescription(dto.getTaskDescription());
        timesheet.setCategory(dto.getCategory());
        timesheet.setLeaveType(dto.getLeaveType());

        // Calculate total hours: (EndTime - StartTime)
        if (dto.getStartTime() != null && dto.getEndTime() != null) {
            Duration duration = Duration.between(dto.getStartTime(), dto.getEndTime());
            double total = duration.toMinutes() / 60.0;
            timesheet.setTotalHours(Math.max(0, total));
        }

        Timesheet saved = timesheetRepository.save(timesheet);

        // Notify RM and HR about new timesheet (if not a weekly batch, but weekly is
        // preferred)
        // For individual entries, we might not want to spam. But the user said "new
        // timesheet received".
        // Usually, weekly is what's monitored.

        return convertToDTO(saved);
    }

    public TimesheetDTO updateTimesheet(Long id, TimesheetDTO dto) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));

        if (timesheet.getStatus() != TimesheetStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PENDING timesheets can be updated");
        }

        if ("PROJECT".equalsIgnoreCase(dto.getCategory())) {
            if (dto.getProject() == null || dto.getProject().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project ID is mandatory for project rows.");
            }
            if (dto.getProjectName() == null || dto.getProjectName().trim().isEmpty()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project Name is mandatory for project rows.");
            }
        }

        timesheet.setDate(dto.getDate());
        timesheet.setStartTime(dto.getStartTime());
        timesheet.setEndTime(dto.getEndTime());
        timesheet.setProject(dto.getProject());
        timesheet.setTask(dto.getTask());
        timesheet.setNotes(dto.getNotes());

        timesheet.setOnsiteOffshore(dto.getOnsiteOffshore());
        timesheet.setBillingLocation(dto.getBillingLocation());
        timesheet.setBillable(dto.getBillable());
        timesheet.setProjectName(dto.getProjectName());
        timesheet.setTaskDescription(dto.getTaskDescription());
        timesheet.setCategory(dto.getCategory());
        timesheet.setLeaveType(dto.getLeaveType());

        // Recalculate total hours: (EndTime - StartTime)
        if (dto.getStartTime() != null && dto.getEndTime() != null) {
            Duration duration = Duration.between(dto.getStartTime(), dto.getEndTime());
            double total = duration.toMinutes() / 60.0;
            timesheet.setTotalHours(Math.max(0, total));
        }

        Timesheet updated = timesheetRepository.save(timesheet);
        return convertToDTO(updated);
    }

    public TimesheetDTO approveTimesheet(Long id, Long reviewerId, String comments) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));

        if (timesheet.getStatus() != TimesheetStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PENDING timesheets can be approved");
        }

        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        timesheet.setStatus(TimesheetStatus.APPROVED);
        timesheet.setManagerComments(comments);
        timesheet.setReviewedBy(reviewer);
        timesheet.setReviewedAt(LocalDateTime.now());

        Timesheet approved = timesheetRepository.save(timesheet);

        // Notify Employee on a weekly basis
        notifyWeeklyTimesheetStatus(approved, "Approved");

        return convertToDTO(approved);
    }

    private void notifyWeeklyTimesheetStatus(Timesheet entry, String status) {
        if (entry.getEmployee().getUser() == null)
            return;

        LocalDate date = entry.getDate();
        // Calculate week start (Saturday is my week start in this app)
        // DayOfWeek.getValue(): 1(Mon) to 7(Sun)
        // If Mon(1), move back 2 days to Sat. (1+2)=3? No.
        // Sat is 6. Sun is 7.
        // If Sat(6), diff=0. If Sun(7), diff=1. If Mon(1), diff=2.
        // Formula for days to subtract: (dayOfWeek + 1) % 7
        int dayValue = date.getDayOfWeek().getValue();
        int daysToSubtract = (dayValue % 7) + 1;
        if (dayValue == 6)
            daysToSubtract = 0; // Saturday
        else if (dayValue == 7)
            daysToSubtract = 1; // Sunday
        else
            daysToSubtract = dayValue + 1; // Mon=2, Tue=3, etc.

        LocalDate weekStart = date.minusDays(daysToSubtract);
        LocalDate weekEnd = weekStart.plusDays(6);

        String message = "Your timesheet for the week starting " + weekStart + " has been " + status.toLowerCase()
                + ".";

        notificationService.createNotification(
                entry.getEmployee().getUser().getId(),
                "Timesheet " + status,
                message,
                "TIMESHEET",
                null);
    }

    public TimesheetDTO rejectTimesheet(Long id, Long reviewerId, String reason) {
        Timesheet timesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));

        if (timesheet.getStatus() != TimesheetStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PENDING timesheets can be rejected");
        }

        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        timesheet.setStatus(TimesheetStatus.REJECTED);
        timesheet.setManagerComments(reason);
        timesheet.setReviewedBy(reviewer);
        timesheet.setReviewedAt(LocalDateTime.now());

        Timesheet rejected = timesheetRepository.save(timesheet);

        // Notify Employee on a weekly basis
        notifyWeeklyTimesheetStatus(rejected, "Rejected");

        return convertToDTO(rejected);
    }

    public void saveWeeklyTimesheet(Long employeeId, LocalDate weekStart, List<TimesheetDTO> entries) {
        // Rule 1 (backend enforcement): an employee may only submit hours for today and past days.
        validateNoFutureEntries(entries);
        validateNoEntriesBeforeJoiningDate(employeeId, entries);

        // Validation: Cannot submit timesheet for the current week until Friday.
        LocalDate today = LocalDate.now();
        LocalDate weekEnd = weekStart.plusDays(6);
        if (!today.isBefore(weekStart) && !today.isAfter(weekEnd)) {
            if (today.isBefore(weekEnd)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Cannot submit timesheet for the current week until Friday.");
            }
        }

        if (entries != null) {
            java.util.Map<LocalDate, Double> dailyTotals = entries.stream()
                .filter(dto -> dto.getDate() != null)
                .collect(java.util.stream.Collectors.groupingBy(
                    TimesheetDTO::getDate,
                    java.util.stream.Collectors.summingDouble(dto -> dto.getTotalHours() != null ? dto.getTotalHours() : 0.0)
                ));
            for (java.util.Map.Entry<LocalDate, Double> entry : dailyTotals.entrySet()) {
                if (entry.getValue() > 8.0) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                            "Total hours for " + entry.getKey() + " cannot exceed 8 hours.");
                }
            }
        }

        // Bulk DELETE via @Modifying @Query — atomic, reliable, flushes & clears
        // automatically
        boolean wasReapplied = false;
        List<Timesheet> existing = timesheetRepository.findByEmployeeIdAndDateBetween(employeeId, weekStart, weekEnd);
        if (existing != null) {
            wasReapplied = existing.stream().anyMatch(t -> t.getReapplyUsed() != null && t.getReapplyUsed());
        }

        timesheetRepository.deleteByEmployeeIdAndDateBetween(employeeId, weekStart, weekEnd);

        System.out.println("[TimesheetService] Deleted existing entries for employeeId=" + employeeId
                + " weekStart=" + weekStart + " weekEnd=" + weekEnd);
        System.out.println("[TimesheetService] Incoming entries count: " + (entries != null ? entries.size() : 0));

        if (entries != null && !entries.isEmpty()) {
            Employee employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

            int savedCount = 0;
            for (TimesheetDTO dto : entries) {
                if ("PROJECT".equalsIgnoreCase(dto.getCategory())) {
                    if (dto.getProject() == null || dto.getProject().trim().isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project ID is mandatory for project rows.");
                    }
                    if (dto.getProjectName() == null || dto.getProjectName().trim().isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project Name is mandatory for project rows.");
                    }
                }

                try {
                    Timesheet timesheet = new Timesheet();
                    timesheet.setEmployee(employee);
                    timesheet.setDate(dto.getDate());
                    timesheet.setStartTime(dto.getStartTime());
                    timesheet.setEndTime(dto.getEndTime());
                    timesheet.setProject(dto.getProject());
                    timesheet.setTask(dto.getTask());
                    timesheet.setNotes(dto.getNotes());
                    timesheet.setStatus(TimesheetStatus.PENDING);
                    timesheet.setOnsiteOffshore(dto.getOnsiteOffshore());
                    timesheet.setBillingLocation(dto.getBillingLocation());
                    timesheet.setBillable(dto.getBillable());
                    timesheet.setProjectName(dto.getProjectName());
                    timesheet.setTaskDescription(dto.getTaskDescription());
                    timesheet.setCategory(dto.getCategory());
                    timesheet.setLeaveType(dto.getLeaveType());
                    timesheet.setRowIndex(dto.getRowIndex());
                    timesheet.setReapplyUsed(wasReapplied);
                    // Use totalHours directly from DTO; only compute from times if not provided
                    if (dto.getTotalHours() != null && dto.getTotalHours() > 0) {
                        timesheet.setTotalHours(dto.getTotalHours());
                    } else if (dto.getStartTime() != null && dto.getEndTime() != null) {
                        Duration duration = Duration.between(dto.getStartTime(), dto.getEndTime());
                        timesheet.setTotalHours(Math.max(0, duration.toMinutes() / 60.0));
                    }
                    timesheetRepository.save(timesheet);
                    savedCount++;
                    System.out.println("[TimesheetService] Saved entry #" + savedCount
                            + " date=" + dto.getDate() + " hours=" + dto.getTotalHours()
                            + " category=" + dto.getCategory());
                } catch (Exception e) {
                    System.err.println("[TimesheetService] FAILED to save entry date=" + dto.getDate()
                            + " hours=" + dto.getTotalHours() + " error=" + e.getMessage());
                    throw e; // re-throw so transaction rolls back fully
                }
            }
            System.out.println("[TimesheetService] Total saved: " + savedCount + " entries");

            // Send notification after all rows are saved
            sendWeeklyTimesheetNotification(employeeId, weekStart);
        }
    }

    // Rule 1: reject any entry whose date is in the future (later than today). Enforced on both
    // the save-draft and submit paths so a crafted request can never bypass the UI's column locking.
    private void validateNoFutureEntries(List<TimesheetDTO> entries) {
        if (entries == null)
            return;
        LocalDate today = LocalDate.now();
        for (TimesheetDTO dto : entries) {
            if (dto.getDate() != null && dto.getDate().isAfter(today)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Future date entries are not allowed.");
            }
        }
    }

    private void validateNoEntriesBeforeJoiningDate(Long employeeId, List<TimesheetDTO> entries) {
        if (entries == null)
            return;
        LocalDate joiningDate = companyDetailRepository.findByEmployee_Id(employeeId)
                .map(CompanyDetail::getJoiningDate)
                .orElse(null);
        if (joiningDate != null) {
            for (TimesheetDTO dto : entries) {
                if (dto.getDate() != null && dto.getDate().isBefore(joiningDate)) {
                    if (dto.getTotalHours() != null && dto.getTotalHours() > 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Cannot log working hours before your joining date: " + dto.getDate());
                    }
                }
            }
        }
    }

    // Rule 2: persist the week as a DRAFT without triggering the approval flow.
    // - No existing timesheet for the week, or an existing DRAFT/REJECTED one -> (re)save as DRAFT.
    // - Week already in the approval flow (PENDING) or APPROVED -> reject; it can no longer be edited as a draft.
    public void saveDraftTimesheet(Long employeeId, LocalDate weekStart, List<TimesheetDTO> entries) {
        validateNoFutureEntries(entries);
        validateNoEntriesBeforeJoiningDate(employeeId, entries);

        LocalDate weekEnd = weekStart.plusDays(6);

        // Guard against saving a draft over a week that has already been submitted/approved.
        List<Timesheet> existing = timesheetRepository.findByEmployeeIdAndDateBetween(employeeId, weekStart, weekEnd);
        boolean lockedByApprovalFlow = existing.stream()
                .anyMatch(t -> t.getStatus() == TimesheetStatus.PENDING || t.getStatus() == TimesheetStatus.APPROVED);
        if (lockedByApprovalFlow) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot save draft — timesheet already submitted.");
        }

        // Same validation the submit path applies to project rows.
        if (entries != null) {
            for (TimesheetDTO dto : entries) {
                if ("PROJECT".equalsIgnoreCase(dto.getCategory())) {
                    if (dto.getProject() == null || dto.getProject().trim().isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project ID is mandatory for project rows.");
                    }
                    if (dto.getProjectName() == null || dto.getProjectName().trim().isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Project Name is mandatory for project rows.");
                    }
                }
            }
        }

        // Replace the week's entries with the incoming draft snapshot (mirrors saveWeeklyTimesheet).
        boolean wasReapplied = false;
        if (existing != null) {
            wasReapplied = existing.stream().anyMatch(t -> t.getReapplyUsed() != null && t.getReapplyUsed());
        }

        timesheetRepository.deleteByEmployeeIdAndDateBetween(employeeId, weekStart, weekEnd);

        if (entries != null && !entries.isEmpty()) {
            Employee employee = employeeRepository.findById(employeeId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

            for (TimesheetDTO dto : entries) {
                Timesheet timesheet = new Timesheet();
                timesheet.setEmployee(employee);
                timesheet.setDate(dto.getDate());
                timesheet.setStartTime(dto.getStartTime());
                timesheet.setEndTime(dto.getEndTime());
                timesheet.setProject(dto.getProject());
                timesheet.setTask(dto.getTask());
                timesheet.setNotes(dto.getNotes());
                // The distinguishing line: a draft never enters the approval flow.
                timesheet.setStatus(TimesheetStatus.DRAFT);
                timesheet.setOnsiteOffshore(dto.getOnsiteOffshore());
                timesheet.setBillingLocation(dto.getBillingLocation());
                timesheet.setBillable(dto.getBillable());
                timesheet.setProjectName(dto.getProjectName());
                timesheet.setTaskDescription(dto.getTaskDescription());
                timesheet.setCategory(dto.getCategory());
                timesheet.setLeaveType(dto.getLeaveType());
                timesheet.setRowIndex(dto.getRowIndex());
                timesheet.setReapplyUsed(wasReapplied);
                if (dto.getTotalHours() != null && dto.getTotalHours() > 0) {
                    timesheet.setTotalHours(dto.getTotalHours());
                } else if (dto.getStartTime() != null && dto.getEndTime() != null) {
                    Duration duration = Duration.between(dto.getStartTime(), dto.getEndTime());
                    timesheet.setTotalHours(Math.max(0, duration.toMinutes() / 60.0));
                }
                timesheetRepository.save(timesheet);
            }
        }
        // NOTE: no notification is sent — a draft must not alert RM/HR/Admin.
    }

    private void sendWeeklyTimesheetNotification(Long employeeId, LocalDate weekStart) {
        try {
            Employee employee = employeeRepository.findById(employeeId).orElse(null);
            if (employee == null)
                return;

            String employeeName = employee.getFirstName() + " " + employee.getLastName();
            String message = employeeName + " has submitted a weekly timesheet starting from " + weekStart + ".";

            System.out.println("[Notification] Sending timesheet notification for: " + employeeName);

            // Fallback: try both lookup methods
            EmployeeReporting reporting = employeeReportingRepository.findByEmployee(employee)
                    .orElseGet(() -> employeeReportingRepository.findByEmployee_Id(employeeId).orElse(null));

            System.out.println("[Notification] EmployeeReporting found: " + (reporting != null));

            // Notify RM
            if (reporting != null && reporting.getReportingManager() != null) {
                Employee rm = reporting.getReportingManager();
                System.out.println("[Notification] RM: " + rm.getFirstName() + ", User: "
                        + (rm.getUser() != null ? rm.getUser().getId() : "NULL"));
                if (rm.getUser() != null) {
                    notificationService.createNotification(
                            rm.getUser().getId(),
                            "New Timesheet Submission",
                            message,
                            "TIMESHEET",
                            null);
                    System.out.println("[Notification] ✓ Notified RM userId=" + rm.getUser().getId());
                }
            } else {
                System.out.println("[Notification] ⚠ No reporting manager found for: " + employeeName);
            }

            // Notify HR - Only if the employee is a Reporting Manager (HR monitors
            // managers)
            if (employee.getUser() != null && employee.getUser().getRole() == com.hrms.model.Role.REPORTING_MANAGER) {
                List<User> hrUsers = userRepository.findByRole(com.hrms.model.Role.HR);
                System.out.println("[Notification] HR users count: " + hrUsers.size());
                for (User hr : hrUsers) {
                    notificationService.createNotification(hr.getId(), "New Timesheet Submission", message, "TIMESHEET",
                            null);
                    System.out.println("[Notification] ✓ Notified HR userId=" + hr.getId());
                }
            } else {
                System.out.println("[Notification] Skipping HR notification (submitter not a manager)");
            }

            // Notify Admin
            List<User> adminUsers = userRepository.findByRole(com.hrms.model.Role.ADMIN);
            System.out.println("[Notification] Admin users count: " + adminUsers.size());
            for (User admin : adminUsers) {
                notificationService.createNotification(admin.getId(), "New Timesheet Submission", message, "TIMESHEET",
                        null);
                System.out.println("[Notification] ✓ Notified Admin userId=" + admin.getId());
            }
        } catch (Exception e) {
            System.err.println("[Notification] ✗ Failed to send weekly timesheet notifications: " + e.getMessage());
            e.printStackTrace();
        }
    }

    public List<TimesheetDTO> getTeamTimesheets(Long managerId) {
        List<Timesheet> timesheets = timesheetRepository.findByManagerId(managerId);
        return timesheets.stream()
                // Drafts are not part of the approval flow — never show them to a reporting manager.
                .filter(t -> t.getStatus() != TimesheetStatus.DRAFT)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    private TimesheetDTO convertToDTO(Timesheet timesheet) {
        TimesheetDTO dto = new TimesheetDTO();
        dto.setId(timesheet.getId());
        dto.setEmployeeId(timesheet.getEmployee().getId());

        // Add employee name
        String fullName = timesheet.getEmployee().getFirstName() + " " + timesheet.getEmployee().getLastName();
        dto.setEmployeeName(fullName);
        // Expose the employee's account status so disabled accounts can be flagged read-only
        // in Admin/HR/RM views. Records of disabled employees are still returned (no filtering).
        dto.setEmployeeStatus(
                Boolean.FALSE.equals(timesheet.getEmployee().getActive()) ? "INACTIVE" : "ACTIVE");

        dto.setDate(timesheet.getDate());
        dto.setStartTime(timesheet.getStartTime());
        dto.setEndTime(timesheet.getEndTime());
        dto.setTotalHours(timesheet.getTotalHours());
        dto.setProject(timesheet.getProject());
        dto.setTask(timesheet.getTask());
        dto.setNotes(timesheet.getNotes());
        dto.setStatus(timesheet.getStatus().name());
        dto.setManagerComments(timesheet.getManagerComments());

        dto.setOnsiteOffshore(timesheet.getOnsiteOffshore());
        dto.setBillingLocation(timesheet.getBillingLocation());
        dto.setBillable(timesheet.getBillable());
        dto.setProjectName(timesheet.getProjectName());
        dto.setTaskDescription(timesheet.getTaskDescription());
        dto.setCategory(timesheet.getCategory());
        dto.setLeaveType(timesheet.getLeaveType());
        dto.setRowIndex(timesheet.getRowIndex());
        dto.setReapplyUsed(timesheet.getReapplyUsed());
        return dto;
    }

    public TimesheetDTO requestReapply(Long id, Long reviewerId, String reason) {
        Timesheet targetTimesheet = timesheetRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Timesheet not found"));

        if (targetTimesheet.getStatus() != TimesheetStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only APPROVED timesheets can be requested for reapply");
        }

        LocalDate date = targetTimesheet.getDate();
        int dayValue = date.getDayOfWeek().getValue();
        int daysToSubtract = (dayValue % 7) + 1;
        if (dayValue == 6) daysToSubtract = 0;
        else if (dayValue == 7) daysToSubtract = 1;
        else daysToSubtract = dayValue + 1;

        LocalDate weekStart = date.minusDays(daysToSubtract);
        LocalDate weekEnd = weekStart.plusDays(6);
        Long employeeId = targetTimesheet.getEmployee().getId();

        List<Timesheet> weekEntries = timesheetRepository.findByEmployeeIdAndDateBetween(employeeId, weekStart, weekEnd);
        boolean alreadyUsed = weekEntries.stream().anyMatch(t -> t.getReapplyUsed() != null && t.getReapplyUsed());
        if (alreadyUsed) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The reapply process has already been used once for this timesheet.");
        }

        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reviewer not found"));

        for (Timesheet t : weekEntries) {
            if (t.getStatus() == TimesheetStatus.APPROVED) {
                t.setStatus(TimesheetStatus.REAPPLY_REQUESTED);
                t.setReapplyUsed(true);
                t.setManagerComments(reason);
                t.setReviewedBy(reviewer);
                t.setReviewedAt(LocalDateTime.now());
                timesheetRepository.save(t);
            }
        }

        notifyWeeklyTimesheetStatus(targetTimesheet, "Reapply Requested");

        return convertToDTO(targetTimesheet);
    }
}
