package com.hrms.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "leave_balances")
public class LeaveBalance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @OneToOne
    @JoinColumn(name = "employee_id", nullable = false, unique = true)
    @JsonIgnore
    private Employee employee;
    
    private Double casualLeavesTotal = 0.0;
    private Double casualLeavesUsed = 0.0;
    
    private Double sickLeavesTotal = 0.0;
    private Double sickLeavesUsed = 0.0;
    
    private Double earnedLeavesTotal = 0.0;
    private Double earnedLeavesUsed = 0.0;
    
    private LocalDateTime lastUpdated;
    
    @PrePersist
    protected void onCreate() {
        lastUpdated = LocalDateTime.now();
    }
    
    @PreUpdate
    protected void onUpdate() {
        lastUpdated = LocalDateTime.now();
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public Employee getEmployee() {
        return employee;
    }
    
    public void setEmployee(Employee employee) {
        this.employee = employee;
    }
    
    public Double getCasualLeavesTotal() {
        return casualLeavesTotal;
    }
    
    public void setCasualLeavesTotal(Double casualLeavesTotal) {
        this.casualLeavesTotal = casualLeavesTotal;
    }
    
    public Double getCasualLeavesUsed() {
        return casualLeavesUsed;
    }
    
    public void setCasualLeavesUsed(Double casualLeavesUsed) {
        this.casualLeavesUsed = casualLeavesUsed;
    }
    
    public Double getCasualLeavesRemaining() {
        double total = casualLeavesTotal != null ? casualLeavesTotal : 0.0;
        double used = casualLeavesUsed != null ? casualLeavesUsed : 0.0;
        return Math.round((total - used) * 100.0) / 100.0;
    }
    
    public Double getSickLeavesTotal() {
        return sickLeavesTotal;
    }
    
    public void setSickLeavesTotal(Double sickLeavesTotal) {
        this.sickLeavesTotal = sickLeavesTotal;
    }
    
    public Double getSickLeavesUsed() {
        return sickLeavesUsed;
    }
    
    public void setSickLeavesUsed(Double sickLeavesUsed) {
        this.sickLeavesUsed = sickLeavesUsed;
    }
    
    public Double getSickLeavesRemaining() {
        double total = sickLeavesTotal != null ? sickLeavesTotal : 0.0;
        double used = sickLeavesUsed != null ? sickLeavesUsed : 0.0;
        return Math.round((total - used) * 100.0) / 100.0;
    }
    
    public Double getEarnedLeavesTotal() {
        return earnedLeavesTotal;
    }
    
    public void setEarnedLeavesTotal(Double earnedLeavesTotal) {
        this.earnedLeavesTotal = earnedLeavesTotal;
    }
    
    public Double getEarnedLeavesUsed() {
        return earnedLeavesUsed;
    }
    
    public void setEarnedLeavesUsed(Double earnedLeavesUsed) {
        this.earnedLeavesUsed = earnedLeavesUsed;
    }
    
    public Double getEarnedLeavesRemaining() {
        double total = earnedLeavesTotal != null ? earnedLeavesTotal : 0.0;
        double used = earnedLeavesUsed != null ? earnedLeavesUsed : 0.0;
        return Math.round((total - used) * 100.0) / 100.0;
    }
    
    public LocalDateTime getLastUpdated() {
        return lastUpdated;
    }
    
    public void setLastUpdated(LocalDateTime lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
}
