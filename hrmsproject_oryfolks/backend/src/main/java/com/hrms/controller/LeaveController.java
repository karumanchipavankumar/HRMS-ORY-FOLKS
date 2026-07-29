package com.hrms.controller;

import com.hrms.dto.ApiResponse;
import com.hrms.dto.LeaveDTO;
import com.hrms.model.LeaveBalance;
import com.hrms.service.LeaveService;
import com.hrms.service.LeaveBalanceService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Comparator;
import com.hrms.model.Leave;

@RestController
@RequestMapping("/api/leaves")
@CrossOrigin(origins = "http://localhost:3000")
public class LeaveController {
    
    @Autowired
    private LeaveService leaveService;
    
    @Autowired
    private LeaveBalanceService leaveBalanceService;
    
    @GetMapping
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getAllLeaves() {
        List<LeaveDTO> leaves = leaveService.getAllLeaves();
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<LeaveDTO>> getLeaveById(@PathVariable Long id) {
        LeaveDTO leave = leaveService.getLeaveById(id);
        return ResponseEntity.ok(ApiResponse.success(leave));
    }
    
    @GetMapping("/employee/{employeeId}")
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getLeavesByEmployee(@PathVariable Long employeeId) {
        List<LeaveDTO> leaves = leaveService.getLeavesByEmployeeId(employeeId);
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    @GetMapping("/employee/{employeeId}/recent")
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getRecentLeavesByEmployee(@PathVariable Long employeeId, @RequestParam(defaultValue = "5") int limit) {
        List<LeaveDTO> leaves = leaveService.getRecentLeavesByEmployeeId(employeeId, limit);
        return ResponseEntity.ok(ApiResponse.success(leaves));
    }
    
    @PostMapping
    public ResponseEntity<ApiResponse<LeaveDTO>> createLeave(@Valid @RequestBody LeaveDTO dto) {
        LeaveDTO created = leaveService.createLeave(dto);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Leave application submitted successfully", created));
    }
    
    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<LeaveDTO>> approveLeave(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long approverId = Long.valueOf(request.get("approverId").toString());
        LeaveDTO approved = leaveService.approveLeave(id, approverId);
        return ResponseEntity.ok(ApiResponse.success("Leave approved successfully", approved));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('ADMIN') or hasRole('HR') or hasRole('REPORTING_MANAGER')")
    public ResponseEntity<ApiResponse<LeaveDTO>> rejectLeave(
            @PathVariable Long id,
            @RequestBody Map<String, Object> request) {
        Long approverId = Long.valueOf(request.get("approverId").toString());
        String reason = request.get("reason").toString();
        LeaveDTO rejected = leaveService.rejectLeave(id, approverId, reason);
        return ResponseEntity.ok(ApiResponse.success("Leave rejected", rejected));
    }
    
    @GetMapping("/balance/{employeeId}")
    public ResponseEntity<ApiResponse<LeaveBalance>> getLeaveBalance(@PathVariable Long employeeId) {
        LeaveBalance balance = leaveBalanceService.getLeaveBalance(employeeId);
        return ResponseEntity.ok(ApiResponse.success(balance));
    }
    
    @PostMapping("/balance/initialize/{employeeId}")
    public ResponseEntity<ApiResponse<LeaveBalance>> initializeLeaveBalance(@PathVariable Long employeeId) {
        LeaveBalance balance = leaveBalanceService.initializeLeaveBalance(employeeId);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Leave balance initialized successfully", balance));
    }
    // Get all leaves for team members of a manager
    @GetMapping("/manager/{managerId}/team-leaves")
    public ResponseEntity<ApiResponse<List<LeaveDTO>>> getTeamLeavesByManager(@PathVariable Long managerId) {
        List<Leave> leaves = leaveService.getTeamLeavesByManagerId(managerId);
        // Sort: pending on top, then by date (optional)
        leaves.sort(Comparator.comparing((Leave l) -> !"PENDING".equalsIgnoreCase(l.getStatus().name()))
                .thenComparing(Leave::getStartDate));
        List<LeaveDTO> dtos = leaves.stream().map(leaveService::convertToDTO).toList();
        return ResponseEntity.ok(ApiResponse.success(dtos));
    }
}

