package com.hrms.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "leaves")
public class Leave {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @ManyToOne
    @JoinColumn(name = "employee_id", nullable = false)
    @NotNull
    @JsonIgnore
    private Employee employee;
    
    @NotNull
    private LocalDate startDate;
    
    @NotNull
    private LocalDate endDate;
    
    @Enumerated(EnumType.STRING)
    private LeaveType leaveType;
    
    private String reason;
    
    @Enumerated(EnumType.STRING)
    private LeaveStatus status = LeaveStatus.PENDING;
    
    private String rejectionReason;
    
    @ManyToOne
    @JoinColumn(name = "approved_by_id")
    private User approvedBy;
    
    private LocalDateTime submittedAt;
    
    private LocalDateTime reviewedAt;
    
    private Double daysCount;
    
    @Column(columnDefinition = "TEXT")
    private String sessionData;

    @OneToMany(mappedBy = "leave", cascade = CascadeType.ALL, orphanRemoval = true)
    private java.util.List<LeaveDayDetail> dayDetails = new java.util.ArrayList<>();
    
    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Employee getEmployee() { return employee; }
    public void setEmployee(Employee employee) { this.employee = employee; }
    public LocalDate getStartDate() { return startDate; }
    public void setStartDate(LocalDate startDate) { this.startDate = startDate; }
    public LocalDate getEndDate() { return endDate; }
    public void setEndDate(LocalDate endDate) { this.endDate = endDate; }
    public LeaveType getLeaveType() { return leaveType; }
    public void setLeaveType(LeaveType leaveType) { this.leaveType = leaveType; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public LeaveStatus getStatus() { return status; }
    public void setStatus(LeaveStatus status) { this.status = status; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public User getApprovedBy() { return approvedBy; }
    public void setApprovedBy(User approvedBy) { this.approvedBy = approvedBy; }
    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }
    public LocalDateTime getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(LocalDateTime reviewedAt) { this.reviewedAt = reviewedAt; }
    public Double getDaysCount() { return daysCount; }
    public void setDaysCount(Double daysCount) { this.daysCount = daysCount; }
    public String getSessionData() { return sessionData; }
    public void setSessionData(String sessionData) { this.sessionData = sessionData; }
    public java.util.List<LeaveDayDetail> getDayDetails() { return dayDetails; }
    public void setDayDetails(java.util.List<LeaveDayDetail> dayDetails) { this.dayDetails = dayDetails; }
}
