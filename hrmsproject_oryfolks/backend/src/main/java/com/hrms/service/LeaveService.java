package com.hrms.service;

import com.hrms.dto.LeaveDTO;
import com.hrms.dto.CalendarAttendanceDTO;
import com.hrms.model.Employee;
import com.hrms.model.Leave;
import com.hrms.model.LeaveBalance;
import com.hrms.model.LeaveStatus;
import com.hrms.model.LeaveType;
import com.hrms.model.User;
import com.hrms.model.LeaveDayDetail;
import com.hrms.model.CompanyDetail;
import com.hrms.model.EmployeeReporting;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.LeaveRepository;
import com.hrms.repository.LeaveBalanceRepository;
import com.hrms.repository.UserRepository;
import com.hrms.repository.LeaveDayDetailRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Transactional
public class LeaveService {

    @Autowired
    private LeaveRepository leaveRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private com.hrms.repository.CompanyDetailRepository companyDetailRepository;

    @Autowired
    private com.hrms.repository.EmployeeReportingRepository employeeReportingRepository;

    @Autowired
    private com.hrms.repository.HolidayRepository holidayRepository;

    @Autowired
    private LeaveDayDetailRepository leaveDayDetailRepository;

    @Autowired
    private NotificationService notificationService;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Fetch all leaves for team members of a manager
    public List<Leave> getTeamLeavesByManagerId(Long managerId) {
        List<com.hrms.model.EmployeeReporting> team = employeeReportingRepository
                .findAllByReportingManager_Id(managerId);
        List<Long> employeeIds = team.stream().map(er -> er.getEmployee().getId())
                .collect(java.util.stream.Collectors.toList());
        if (employeeIds.isEmpty()) {
            return java.util.Collections.emptyList();
        }
        return leaveRepository.findByEmployeeIdIn(employeeIds);
    }

    public List<LeaveDTO> getAllLeaves() {
        return leaveRepository.findAll().stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public LeaveDTO getLeaveById(Long id) {
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave not found"));
        return convertToDTO(leave);
    }

    public List<LeaveDTO> getLeavesByEmployeeId(Long employeeId) {
        return leaveRepository.findByEmployeeIdOrderBySubmittedAtDesc(employeeId).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public List<LeaveDTO> getRecentLeavesByEmployeeId(Long employeeId, int limit) {
        return leaveRepository.findByEmployeeIdOrderBySubmittedAtDesc(employeeId).stream()
                .limit(limit)
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    public LeaveDTO createLeave(LeaveDTO dto) {
        Employee employee = employeeRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        CompanyDetail detail = companyDetailRepository.findByEmployee_Id(employee.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Company details not found"));

        if (detail.getJoiningDate() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Employee joining date is missing");
        }

        LocalDate now = LocalDate.now();
        LocalDate eligibilityDateStage1 = detail.getJoiningDate().plusMonths(6);
        LocalDate elEligibilityDate = detail.getJoiningDate().plusYears(1);

        LeaveType leaveType;
        if (dto.getLeaveType() != null) {
            try {
                leaveType = LeaveType.valueOf(dto.getLeaveType().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid leave type: " + dto.getLeaveType());
            }
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Leave type is required");
        }

        // 1. First 6 months probation (No leave allowed except LOP)
        if (now.isBefore(eligibilityDateStage1) && leaveType != LeaveType.LOP) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                "Leave is not allowed during the first 6 months of service (Probation). Eligibility starts on " + eligibilityDateStage1);
        }

        // LOP can be submitted only after their joining
        if (leaveType == LeaveType.LOP && dto.getStartDate().isBefore(detail.getJoiningDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                "LOP leave can be submitted only after your joining date: " + detail.getJoiningDate());
        }

        LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(dto.getEmployeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave balance not found"));
        
        // 2. Earned Leave eligibility check (1 year)
        if (leaveType == LeaveType.EARNED && now.isBefore(elEligibilityDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, 
                "Earned Leave eligibility starts only after 1 year of service. Your EL starts on " + elEligibilityDate);
        }

        double daysRequested = dto.getDaysCount() != null ? dto.getDaysCount() : 0.0;

        // Check if employee has sufficient balance
        if (!hassufficientBalance(balance, leaveType, daysRequested)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Insufficient leave balance");
        }

        Leave leave = new Leave();
        leave.setEmployee(employee);
        leave.setStartDate(dto.getStartDate());
        leave.setEndDate(dto.getEndDate());
        leave.setLeaveType(leaveType);
        leave.setReason(dto.getReason());
        leave.setStatus(LeaveStatus.PENDING);
        leave.setDaysCount(daysRequested);
        
        try {
            if (dto.getSessionData() != null) {
                leave.setSessionData(objectMapper.writeValueAsString(dto.getSessionData()));
            }
        } catch (JsonProcessingException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to process session data");
        }

        Leave saved = leaveRepository.save(leave);

        // Save daily breakdown to leave_details table
        if (dto.getSessionData() != null) {
            List<LeaveDayDetail> details = new ArrayList<>();
            dto.getSessionData().forEach((dateStr, session) -> {
                LeaveDayDetail dayDetail = new LeaveDayDetail();
                dayDetail.setLeave(saved);
                dayDetail.setLeaveDate(LocalDate.parse(dateStr));
                dayDetail.setDayType(session);
                details.add(dayDetail);
            });
            leaveDayDetailRepository.saveAll(details);
            saved.setDayDetails(details);
        }

        // Deduct balance immediately on submission
        updateLeaveBalance(saved, true);

        // Send Email Notifications
        sendLeaveEmails(saved);

        // Send In-App Notifications
        sendLeaveInAppNotifications(saved);

        return convertToDTO(saved);
    }

    private void sendLeaveInAppNotifications(Leave leave) {
        try {
            Employee employee = leave.getEmployee();
            String employeeName = employee.getFirstName() + " " + employee.getLastName();
            String leaveTypeName = leave.getLeaveType().name();
            String message = employeeName + " has submitted a " + leaveTypeName
                    + " leave request from " + leave.getStartDate() + " to " + leave.getEndDate()
                    + " (" + leave.getDaysCount() + " days).";

            System.out.println("[Notification] Sending leave notification for: " + employeeName);

            // Try to find reporting
            EmployeeReporting reporting = employeeReportingRepository.findByEmployee(employee)
                    .orElseGet(() -> employeeReportingRepository.findByEmployee_Id(employee.getId()).orElse(null));

            System.out.println("[Notification] EmployeeReporting found: " + (reporting != null));

            // Notify RM
            if (reporting != null && reporting.getReportingManager() != null) {
                Employee rm = reporting.getReportingManager();
                System.out.println("[Notification] RM: " + rm.getFirstName() + ", User: " + (rm.getUser() != null ? rm.getUser().getId() : "NULL"));
                if (rm.getUser() != null) {
                    notificationService.createNotification(
                        rm.getUser().getId(),
                        "New Leave Request",
                        message,
                        "LEAVE",
                        leave.getId()
                    );
                    System.out.println("[Notification] ✓ Notified RM userId=" + rm.getUser().getId());
                }
            } else {
                System.out.println("[Notification] ⚠ No reporting manager found for employee: " + employeeName);
            }

            // Notify HR
            List<User> hrUsers = userRepository.findByRole(com.hrms.model.Role.HR);
            System.out.println("[Notification] HR users count: " + hrUsers.size());
            for (User hr : hrUsers) {
                notificationService.createNotification(hr.getId(), "New Leave Request", message, "LEAVE", leave.getId());
                System.out.println("[Notification] ✓ Notified HR userId=" + hr.getId());
            }

            // Notify Admin
            List<User> adminUsers = userRepository.findByRole(com.hrms.model.Role.ADMIN);
            System.out.println("[Notification] Admin users count: " + adminUsers.size());
            for (User admin : adminUsers) {
                notificationService.createNotification(admin.getId(), "New Leave Request", message, "LEAVE", leave.getId());
                System.out.println("[Notification] ✓ Notified Admin userId=" + admin.getId());
            }
        } catch (Exception e) {
            System.err.println("[Notification] ✗ Failed to send leave in-app notifications: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void sendLeaveEmails(Leave leave) {
        try {
            Employee employee = leave.getEmployee();
            User user = employee.getUser();
            if (user == null)
                return;

            String employeeName = employee.getFirstName() + " " + employee.getLastName();
            String leaveType = leave.getLeaveType().name();
            String startDate = leave.getStartDate().toString();
            String endDate = leave.getEndDate().toString();
            String reason = leave.getReason();
            String role = user.getRole().name();

            List<String> to = new ArrayList<>();
            List<String> cc = new ArrayList<>();

            // 1. Employee's own corporate email (Add requester in TO)
            String employeeCorporateEmail = getCorporateEmail(employee);
            if (employeeCorporateEmail != null)
                to.add(employeeCorporateEmail);

            // Fetch reporting hierarchy
            EmployeeReporting reporting = employeeReportingRepository.findByEmployee(employee).orElse(null);

            if (user.getRole() == com.hrms.model.Role.EMPLOYEE) {
                // To: Manager, Self. CC: HR.
                if (reporting != null && reporting.getReportingManager() != null) {
                    String managerEmail = getCorporateEmail(reporting.getReportingManager());
                    if (managerEmail != null)
                        to.add(managerEmail);
                }

                // Always include HR in CC
                List<String> hrEmails = new ArrayList<>();
                if (reporting != null && reporting.getHr() != null) {
                    String hrEmail = getCorporateEmail(reporting.getHr());
                    if (hrEmail != null)
                        hrEmails.add(hrEmail);
                }

                if (hrEmails.isEmpty()) {
                    hrEmails = getHrEmails();
                }
                cc.addAll(hrEmails);

            } else if (user.getRole() == com.hrms.model.Role.REPORTING_MANAGER) {
                // To: HR, Self.
                List<String> hrEmails = new ArrayList<>();
                if (reporting != null && reporting.getHr() != null) {
                    String hrEmail = getCorporateEmail(reporting.getHr());
                    if (hrEmail != null)
                        hrEmails.add(hrEmail);
                }

                if (hrEmails.isEmpty()) {
                    hrEmails = getHrEmails();
                }
                to.addAll(hrEmails);
            } else if (user.getRole() == com.hrms.model.Role.HR) {
                // To: Admin, Self.
                List<User> admins = userRepository.findByRole(com.hrms.model.Role.ADMIN);
                for (User admin : admins) {
                    if (admin.getEmail() != null)
                        to.add(admin.getEmail());
                }
            }

            String[] toArr = to.stream().distinct().toArray(String[]::new);
            String[] ccArr = cc.stream().distinct().toArray(String[]::new);

            String breakdown = formatBreakdown(leave);
            
            LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(employee.getId()).orElse(null);
            Double cBal = balance != null ? balance.getCasualLeavesRemaining() : 0.0;
            Double sBal = balance != null ? balance.getSickLeavesRemaining() : 0.0;
            Double eBal = balance != null ? balance.getEarnedLeavesRemaining() : 0.0;

            if (toArr.length > 0) {
                emailService.sendLeaveRequestEmail(toArr, ccArr, employeeName, leaveType, startDate, endDate, leave.getDaysCount(), reason,
                        role, breakdown, cBal, sBal, eBal);
            }
        } catch (Exception e) {
            System.err.println("Failed to send leave request emails: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private List<String> getHrEmails() {
        List<String> hrEmails = new ArrayList<>();
        List<User> hrUsers = userRepository.findByRole(com.hrms.model.Role.HR);
        for (User u : hrUsers) {
            String email = null;
            var empOpt = employeeRepository.findByUser(u);
            if (empOpt.isPresent()) {
                email = getCorporateEmail(empOpt.get());
            }
            if (email == null || email.isEmpty()) {
                email = u.getEmail();
            }
            if (email != null && !email.isEmpty()) {
                hrEmails.add(email);
            }
        }
        return hrEmails;
    }

    private String getCorporateEmail(Employee employee) {
        return companyDetailRepository.findByEmployee_Id(employee.getId())
                .map(cd -> cd.getOryfolksMailId())
                .orElse(null);
    }

    public LeaveDTO approveLeave(Long id, Long approverId) {
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave not found"));

        if (leave.getStatus() != LeaveStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PENDING leaves can be approved");
        }

        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approver not found"));

        leave.setStatus(LeaveStatus.APPROVED);
        leave.setApprovedBy(approver);
        leave.setReviewedAt(LocalDateTime.now());

        Leave approved = leaveRepository.save(leave);

        // Send Status Email
        sendStatusEmail(approved);

        // Send In-App Notification
        if (approved.getEmployee().getUser() != null) {
            notificationService.createNotification(
                approved.getEmployee().getUser().getId(),
                "Leave Approved",
                "Your " + approved.getLeaveType() + " leave request has been approved.",
                "LEAVE",
                approved.getId()
            );
        }

        return convertToDTO(approved);
    }

    public LeaveDTO rejectLeave(Long id, Long approverId, String reason) {
        Leave leave = leaveRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave not found"));

        if (leave.getStatus() != LeaveStatus.PENDING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PENDING leaves can be rejected");
        }

        User approver = userRepository.findById(approverId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Approver not found"));

        leave.setStatus(LeaveStatus.REJECTED);
        leave.setRejectionReason(reason);
        leave.setApprovedBy(approver);
        leave.setReviewedAt(LocalDateTime.now());

        Leave rejected = leaveRepository.save(leave);

        // Restore balance on rejection
        updateLeaveBalance(rejected, false);

        // Send Status Email
        sendStatusEmail(rejected);

        // Send In-App Notification
        if (rejected.getEmployee().getUser() != null) {
            notificationService.createNotification(
                rejected.getEmployee().getUser().getId(),
                "Leave Rejected",
                "Your " + rejected.getLeaveType() + " leave request has been rejected. Reason: " + reason,
                "LEAVE",
                rejected.getId()
            );
        }

        return convertToDTO(rejected);
    }

    private void sendStatusEmail(Leave leave) {
        try {
            Employee employee = leave.getEmployee();
            String employeeEmail = getCorporateEmail(employee);
            if (employeeEmail == null)
                return;

            String status = leave.getStatus().name();
            String reason = leave.getRejectionReason();
            String reviewerName = "Approver";
            String approverEmail = null;

            if (leave.getApprovedBy() != null) {
                approverEmail = leave.getApprovedBy().getEmail();
                var reviewerEmp = employeeRepository.findByUser(leave.getApprovedBy());
                if (reviewerEmp.isPresent()) {
                    reviewerName = reviewerEmp.get().getFirstName() + " " + reviewerEmp.get().getLastName();
                    String corporateMail = getCorporateEmail(reviewerEmp.get());
                    if (corporateMail != null)
                        approverEmail = corporateMail;
                }
            }

            List<String> to = new ArrayList<>();
            List<String> cc = new ArrayList<>();

            // To: Requester, Approver
            to.add(employeeEmail);
            if (approverEmail != null)
                to.add(approverEmail);

            // CC: Based on hierarchy
            EmployeeReporting reporting = employeeReportingRepository.findByEmployee(employee).orElse(null);
            if (reporting != null) {
                if (reporting.getHr() != null) {
                    String hrEmail = getCorporateEmail(reporting.getHr());
                    if (hrEmail != null)
                        cc.add(hrEmail);
                }
                // If HR is the requester, CC Admin? (Hierarchy based)
                if (employee.getUser() != null && employee.getUser().getRole() == com.hrms.model.Role.HR) {
                    List<User> admins = userRepository.findByRole(com.hrms.model.Role.ADMIN);
                    for (User admin : admins) {
                        if (admin.getEmail() != null)
                            cc.add(admin.getEmail());
                    }
                }
            }

            String[] toArr = to.stream().distinct().toArray(String[]::new);
            String[] ccArr = cc.stream().distinct().toArray(String[]::new);

            String breakdown = formatBreakdown(leave);
            
            LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(employee.getId()).orElse(null);
            Double cBal = balance != null ? balance.getCasualLeavesRemaining() : 0.0;
            Double sBal = balance != null ? balance.getSickLeavesRemaining() : 0.0;
            Double eBal = balance != null ? balance.getEarnedLeavesRemaining() : 0.0;

            emailService.sendLeaveStatusEmail(
                    toArr,
                    ccArr,
                    employee.getFirstName() + " " + employee.getLastName(),
                    leave.getLeaveType().name(),
                    leave.getStartDate().toString(),
                    leave.getEndDate().toString(),
                    leave.getDaysCount(),
                    status,
                    reason,
                    reviewerName,
                    breakdown,
                    cBal, sBal, eBal);
        } catch (Exception e) {
            System.err.println("Failed to send leave status email: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private boolean hassufficientBalance(LeaveBalance balance, LeaveType leaveType, double daysRequested) {
        return switch (leaveType) {
            case CASUAL -> balance.getCasualLeavesRemaining() >= daysRequested;
            case SICK -> balance.getSickLeavesRemaining() >= daysRequested;
            case EARNED -> balance.getEarnedLeavesRemaining() >= daysRequested;
            case LOP -> true; // LOP has no limit in terms of balance
        };
    }

    private double calculateLeaveDays(LocalDate startDate, LocalDate endDate, Boolean startHalf, Boolean endHalf) {
        if (startDate == null || endDate == null)
            return 0;
        
        // Fetch all holidays
        List<String> holidayDates = holidayRepository.findAll().stream()
                .map(com.hrms.model.Holiday::getHolidayDate)
                .filter(java.util.Objects::nonNull)
                .map(String::trim)
                .collect(Collectors.toList());

        double totalDays = 0;
        for (LocalDate date = startDate; !date.isAfter(endDate); date = date.plusDays(1)) {
            boolean isWeekend = date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY
                    || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY;
            
            String dateStr = date.toString();
            boolean isHoliday = holidayDates.contains(dateStr);
            
            if (isWeekend || isHoliday) {
                continue;
            }

            if (date.equals(startDate) && date.equals(endDate)) {
                // If both are checked for the same day, it's 0.5. If either is, it's 0.5.
                totalDays += (startHalf != null && startHalf) || (endHalf != null && endHalf) ? 0.5 : 1.0;
            } else if (date.equals(startDate) && startHalf != null && startHalf) {
                totalDays += 0.5;
            } else if (date.equals(endDate) && endHalf != null && endHalf) {
                totalDays += 0.5;
            } else {
                totalDays += 1.0;
            }
        }
        return totalDays;
    }

    private void updateLeaveBalance(Leave leave, boolean deduct) {
        LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(leave.getEmployee().getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leave balance not found"));

        double days = leave.getDaysCount() != null ? leave.getDaysCount() : 0.0;
        double change = deduct ? days : -days;

        switch (leave.getLeaveType()) {
            case CASUAL:
                balance.setCasualLeavesUsed(Math.max(0.0, balance.getCasualLeavesUsed() + change));
                break;
            case SICK:
                balance.setSickLeavesUsed(Math.max(0.0, balance.getSickLeavesUsed() + change));
                break;
            case EARNED:
                balance.setEarnedLeavesUsed(Math.max(0.0, balance.getEarnedLeavesUsed() + change));
                break;
            case LOP:
                // LOP doesn't affect standard leave balance
                break;
        }

        leaveBalanceRepository.save(balance);
    }

    public CalendarAttendanceDTO getCalendarAttendance(LocalDate start, LocalDate end) {
        System.out.println("CALENDAR_DEBUG: Fetching attendance from " + start + " to " + end);
        try {
            // Use repository to filter by status directly
            List<Leave> allApproved = leaveRepository.findByStatus(LeaveStatus.APPROVED);

            System.out.println("CALENDAR_DEBUG: Total approved leaves in DB: " + allApproved.size());

            // Filter by date range in memory
            List<Leave> approvedLeaves = allApproved.stream()
                    .filter(l -> l.getStartDate() != null && l.getEndDate() != null)
                    .filter(l -> !(l.getEndDate().isBefore(start) || l.getStartDate().isAfter(end)))
                    .collect(Collectors.toList());

            System.out.println("CALENDAR_DEBUG: Approved leaves in range: " + approvedLeaves.size());

            Map<String, List<String>> dailyLeaves = new HashMap<>();

            for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
                if (date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY
                        || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY) {
                    continue;
                }

                final LocalDate current = date;
                List<String> names = approvedLeaves.stream()
                        .filter(l -> l.getEmployee() != null)
                        .filter(l -> !current.isBefore(l.getStartDate()) && !current.isAfter(l.getEndDate()))
                        .map(l -> l.getEmployee().getFirstName() + " " + l.getEmployee().getLastName())
                        .collect(Collectors.toList());

                if (!names.isEmpty()) {
                    dailyLeaves.put(current.toString(), names);
                }
            }

            return new CalendarAttendanceDTO(dailyLeaves);
        } catch (Exception e) {
            System.err.println("CALENDAR_ERROR: Failed to calculate attendance: " + e.getMessage());
            e.printStackTrace();
            throw e;
        }
    }

    private String formatBreakdown(Leave leave) {
        if (leave == null || leave.getStartDate() == null || leave.getEndDate() == null) return "";
        
        // Prefer database table values
        final Map<String, String> sessionData = new HashMap<>();
        if (leave.getDayDetails() != null && !leave.getDayDetails().isEmpty()) {
            leave.getDayDetails().forEach(d -> sessionData.put(d.getLeaveDate().toString(), d.getDayType()));
        } else if (leave.getSessionData() != null && !leave.getSessionData().isEmpty()) {
            try {
                sessionData.putAll(objectMapper.readValue(leave.getSessionData(), new TypeReference<Map<String, String>>() {}));
            } catch (Exception e) {
                System.err.println("Failed to parse session data: " + e.getMessage());
            }
        }

        List<String> holidayDates = holidayRepository.findAll().stream()
                .map(com.hrms.model.Holiday::getHolidayDate)
                .filter(java.util.Objects::nonNull)
                .map(String::trim)
                .collect(Collectors.toList());

        StringBuilder sb = new StringBuilder();
        for (LocalDate date = leave.getStartDate(); !date.isAfter(leave.getEndDate()); date = date.plusDays(1)) {
            String dateStr = date.toString();
            sb.append(" - ").append(dateStr).append(": ");
            
            boolean isWeekend = date.getDayOfWeek() == java.time.DayOfWeek.SATURDAY
                    || date.getDayOfWeek() == java.time.DayOfWeek.SUNDAY;
            boolean isHoliday = holidayDates.contains(dateStr);

            if (isHoliday) {
                sb.append("Public Holiday");
            } else if (isWeekend) {
                sb.append("Weekend");
            } else {
                String session = sessionData.get(dateStr);
                if (session != null) {
                    if (session.equalsIgnoreCase("FULL")) sb.append("Full Day");
                    else if (session.equalsIgnoreCase("MORNING")) sb.append("Morning (0.5)");
                    else if (session.equalsIgnoreCase("AFTERNOON")) sb.append("Afternoon (0.5)");
                    else sb.append(session);
                } else {
                    sb.append("—");
                }
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    public LeaveDTO convertToDTO(Leave leave) {
        LeaveDTO dto = new LeaveDTO();
        dto.setId(leave.getId());
        dto.setEmployeeId(leave.getEmployee().getId());
        dto.setEmployeeName(leave.getEmployee().getFirstName() + " " + leave.getEmployee().getLastName());
        // Expose the employee's account status so disabled accounts can be flagged read-only
        // in Admin/HR/RM views. Records of disabled employees are still returned (no filtering).
        dto.setEmployeeStatus(
                Boolean.FALSE.equals(leave.getEmployee().getActive()) ? "INACTIVE" : "ACTIVE");
        dto.setStartDate(leave.getStartDate());
        dto.setEndDate(leave.getEndDate());
        dto.setLeaveType(leave.getLeaveType().name());
        dto.setReason(leave.getReason());
        dto.setStatus(leave.getStatus().name());
        dto.setRejectionReason(leave.getRejectionReason());
        dto.setSubmittedAt(leave.getSubmittedAt());
        if (leave.getApprovedBy() != null) {
            // Look up Employee by User to get full name
            String fullName = null;
            try {
                var empOpt = employeeRepository.findByUser(leave.getApprovedBy());
                if (empOpt.isPresent()) {
                    var emp = empOpt.get();
                    fullName = emp.getFirstName() + " " + emp.getLastName();
                }
            } catch (Exception ignored) {
            }
            dto.setApprovedBy(fullName != null ? fullName : leave.getApprovedBy().getUsername());
        }
        dto.setReviewedAt(leave.getReviewedAt());
        dto.setDaysCount(leave.getDaysCount());
        
        final Map<String, String> sessionMap = new HashMap<>();
        if (leave.getDayDetails() != null && !leave.getDayDetails().isEmpty()) {
            leave.getDayDetails().forEach(d -> sessionMap.put(d.getLeaveDate().toString(), d.getDayType()));
            dto.setSessionData(sessionMap);
        } else if (leave.getSessionData() != null) {
            try {
                sessionMap.putAll(objectMapper.readValue(leave.getSessionData(), new TypeReference<Map<String, String>>() {}));
                dto.setSessionData(sessionMap);
            } catch (JsonProcessingException ignored) {}
        }

        // Populate leave balance
        leaveBalanceRepository.findByEmployeeId(leave.getEmployee().getId()).ifPresent(balance -> {
            dto.setCasualLeavesRemaining(balance.getCasualLeavesRemaining());
            dto.setSickLeavesRemaining(balance.getSickLeavesRemaining());
            dto.setEarnedLeavesRemaining(balance.getEarnedLeavesRemaining());
        });

        companyDetailRepository.findByEmployee_Id(leave.getEmployee().getId()).ifPresent(cd -> {
            dto.setOryfolksId(cd.getOryfolksId());
        });

        return dto;
    }
}
