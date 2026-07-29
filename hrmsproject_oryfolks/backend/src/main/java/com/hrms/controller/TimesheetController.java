package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.TimesheetDTO;
import com.hrms.dto.EmployeeDTO;
import com.hrms.model.User;
import com.hrms.model.UserPrincipal;
import com.hrms.model.Role;
import com.hrms.service.TimesheetService;
import com.hrms.service.EmployeeService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/timesheets")
@CrossOrigin(origins = "http://localhost:3000")
public class TimesheetController {

    @Autowired
    private TimesheetService timesheetService;

    @Autowired
    private EmployeeService employeeService;

    private Long getEmployeeIdFromAuth(Authentication authentication) {
        if (authentication != null && authentication.isAuthenticated()
                && authentication.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal userPrincipal = (UserPrincipal) authentication.getPrincipal();
            User user = userPrincipal.getUser();
            try {
                EmployeeDTO employee = employeeService.getEmployeeByUserId(user.getId());
                return employee.getId();
            } catch (Exception e) {
                return null;
            }
        }
        return null;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TimesheetDTO>>> getAllTimesheets(
            Authentication authentication,
            @RequestParam(required = false) Long employeeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fromDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate toDate,
            @RequestParam(required = false) String status,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer size,
            @RequestParam(required = false, defaultValue = "false") boolean includeDrafts) {

        Long effectiveEmployeeId = employeeId;
        
        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal) {
            UserPrincipal principal = (UserPrincipal) authentication.getPrincipal();
            User user = principal.getUser();
            
            // If user is just an EMPLOYEE or REPORTING_MANAGER, force them to only see their own timesheets.
            // ADMIN and HR can see anyone's timesheets.
            if (user.getRole() == Role.EMPLOYEE || user.getRole() == Role.REPORTING_MANAGER) {
                Long authEmployeeId = getEmployeeIdFromAuth(authentication);
                if (authEmployeeId != null) {
                    effectiveEmployeeId = authEmployeeId;
                }
            }
        }

        // Drafts are only ever returned to the employee who owns them (their own personal timesheet
        // view). Even if a non-owner sets includeDrafts=true, we refuse unless the requested records
        // belong to the authenticated employee — drafts must never leak into other people's views.
        Long authEmployeeId = getEmployeeIdFromAuth(authentication);
        boolean effectiveIncludeDrafts = includeDrafts
                && effectiveEmployeeId != null
                && effectiveEmployeeId.equals(authEmployeeId);

        List<TimesheetDTO> timesheets = timesheetService.getAllTimesheets(
                effectiveEmployeeId, fromDate, toDate, status, page, size, effectiveIncludeDrafts);
        return ResponseEntity.ok(ApiResponse.success(timesheets));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TimesheetDTO>> getTimesheetById(@PathVariable Long id) {
        TimesheetDTO timesheet = timesheetService.getTimesheetById(id);
        return ResponseEntity.ok(ApiResponse.success(timesheet));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<TimesheetDTO>> createTimesheet(
            @Valid @RequestBody TimesheetDTO dto,
            Authentication authentication) {

        Long authEmployeeId = getEmployeeIdFromAuth(authentication);
        if (authEmployeeId != null) {
            dto.setEmployeeId(authEmployeeId);
        } else if (dto.getEmployeeId() == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ApiResponse.error("Employee profile not found. Are you logged in?"));
        }

        TimesheetDTO created = timesheetService.createTimesheet(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Timesheet submitted successfully", created));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<TimesheetDTO>> updateTimesheet(
            @PathVariable Long id,
            @Valid @RequestBody TimesheetDTO dto) {
        TimesheetDTO updated = timesheetService.updateTimesheet(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Timesheet updated successfully", updated));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<TimesheetDTO>> approveTimesheet(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long reviewerId = Long.valueOf(request.get("reviewerId").toString());
        String comments = request.getOrDefault("comments", "").toString();
        TimesheetDTO approved = timesheetService.approveTimesheet(id, reviewerId, comments);
        return ResponseEntity.ok(ApiResponse.success("Timesheet approved successfully", approved));
    }

    @GetMapping("/manager/{managerId}/team-timesheets")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<List<TimesheetDTO>>> getTeamTimesheets(@PathVariable Long managerId) {
        List<TimesheetDTO> timesheets = timesheetService.getTeamTimesheets(managerId);
        return ResponseEntity.ok(ApiResponse.success(timesheets));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<TimesheetDTO>> rejectTimesheet(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long reviewerId = Long.valueOf(request.get("reviewerId").toString());
        String reason = request.get("reason").toString();
        TimesheetDTO rejected = timesheetService.rejectTimesheet(id, reviewerId, reason);
        return ResponseEntity.ok(ApiResponse.success("Timesheet rejected", rejected));
    }

    @PostMapping("/save-weekly")
    public ResponseEntity<ApiResponse<Void>> saveWeekly(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {
        
        Long employeeId = getEmployeeIdFromAuth(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee not found"));
        }

        // Validate required fields up front so missing/invalid input returns 400, not 500.
        Object weekStartRaw = request.get("weekStart");
        Object entriesRaw = request.get("entries");
        if (weekStartRaw == null || weekStartRaw.toString().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("weekStart is required"));
        }
        if (!(entriesRaw instanceof List) || ((List<?>) entriesRaw).isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("entries are required and cannot be empty"));
        }

        LocalDate weekStart;
        try {
            weekStart = LocalDate.parse(weekStartRaw.toString().split("T")[0]);
        } catch (java.time.format.DateTimeParseException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("weekStart is not a valid date"));
        }
        List<Map<String, Object>> entriesList = (List<Map<String, Object>>) entriesRaw;
        List<TimesheetDTO> dtos = mapEntriesToDtos(entriesList);

        timesheetService.saveWeeklyTimesheet(employeeId, weekStart, dtos);
        return ResponseEntity.ok(ApiResponse.success("Weekly timesheet saved successfully", null));
    }

    // Rule 2: save the current week as a DRAFT without entering the approval flow.
    // Accepts the same payload shape as save-weekly; the service enforces future-date and
    // "already submitted" guards and persists everything with status DRAFT.
    @PostMapping("/save-draft")
    public ResponseEntity<ApiResponse<Void>> saveDraft(
            @RequestBody Map<String, Object> request,
            Authentication authentication) {

        Long employeeId = getEmployeeIdFromAuth(authentication);
        if (employeeId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ApiResponse.error("Employee not found"));
        }

        Object weekStartRaw = request.get("weekStart");
        Object entriesRaw = request.get("entries");
        if (weekStartRaw == null || weekStartRaw.toString().isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("weekStart is required"));
        }
        // A draft may legitimately be empty (the employee cleared the week), so we allow an empty
        // entries list here — but the key must still be present and be a list.
        if (!(entriesRaw instanceof List)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("entries must be a list"));
        }

        LocalDate weekStart;
        try {
            weekStart = LocalDate.parse(weekStartRaw.toString().split("T")[0]);
        } catch (java.time.format.DateTimeParseException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error("weekStart is not a valid date"));
        }
        List<Map<String, Object>> entriesList = (List<Map<String, Object>>) entriesRaw;
        List<TimesheetDTO> dtos = mapEntriesToDtos(entriesList);

        timesheetService.saveDraftTimesheet(employeeId, weekStart, dtos);
        return ResponseEntity.ok(ApiResponse.success("Timesheet saved successfully", null));
    }

    // Shared payload -> DTO mapping used by both the submit (save-weekly) and save-draft endpoints.
    private List<TimesheetDTO> mapEntriesToDtos(List<Map<String, Object>> entriesList) {
        return entriesList.stream().map(m -> {
            TimesheetDTO d = new TimesheetDTO();
            d.setDate(LocalDate.parse(m.get("date").toString()));
            if (m.get("startTime") != null) d.setStartTime(java.time.LocalTime.parse(m.get("startTime").toString()));
            if (m.get("endTime") != null) d.setEndTime(java.time.LocalTime.parse(m.get("endTime").toString()));
            d.setProject(m.get("project") != null ? m.get("project").toString() : null);
            d.setTask(m.get("task") != null ? m.get("task").toString() : null);
            d.setNotes(m.get("notes") != null ? m.get("notes").toString() : null);
            d.setCategory(m.get("category") != null ? m.get("category").toString() : null);
            d.setProjectName(m.get("projectName") != null ? m.get("projectName").toString() : null);
            d.setTaskDescription(m.get("taskDescription") != null ? m.get("taskDescription").toString() : null);
            d.setOnsiteOffshore(m.get("onsiteOffshore") != null ? m.get("onsiteOffshore").toString() : null);
            d.setBillingLocation(m.get("billingLocation") != null ? m.get("billingLocation").toString() : null);
            d.setBillable(m.get("billable") != null ? (Boolean) m.get("billable") : null);
            d.setLeaveType(m.get("leaveType") != null ? m.get("leaveType").toString() : null);
            d.setRowIndex(m.get("rowIndex") != null ? Integer.parseInt(m.get("rowIndex").toString()) : null);
            // Map totalHours directly from the frontend payload
            if (m.get("totalHours") != null) {
                d.setTotalHours(Double.parseDouble(m.get("totalHours").toString()));
            }
            return d;
        }).collect(Collectors.toList());
    }
}
