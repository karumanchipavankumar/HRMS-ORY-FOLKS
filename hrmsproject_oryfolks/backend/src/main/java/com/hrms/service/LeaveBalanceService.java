package com.hrms.service;

import com.hrms.model.Employee;
import com.hrms.model.LeaveBalance;
import com.hrms.repository.LeaveBalanceRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.CompanyDetailRepository;
import com.hrms.model.CompanyDetail;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional
public class LeaveBalanceService {

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private EmployeeRepository employeeRepository;

    @Autowired
    private CompanyDetailRepository companyDetailRepository;

    public LeaveBalance initializeLeaveBalance(Long employeeId) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        if (leaveBalanceRepository.findByEmployeeId(employeeId).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Leave balance already exists for this employee");
        }

        LeaveBalance balance = new LeaveBalance();
        balance.setEmployee(employee);
        balance.setCasualLeavesTotal(0.0);
        balance.setCasualLeavesUsed(0.0);
        balance.setSickLeavesTotal(0.0);
        balance.setSickLeavesUsed(0.0);
        balance.setEarnedLeavesTotal(0.0);
        balance.setEarnedLeavesUsed(0.0);

        LeaveBalance saved = leaveBalanceRepository.save(balance);
        return refreshLeaveBalance(saved);
    }

    public LeaveBalance refreshLeaveBalance(LeaveBalance balance) {
        if (balance == null || balance.getEmployee() == null) return balance;
        
        CompanyDetail detail = companyDetailRepository.findByEmployee_Id(balance.getEmployee().getId())
                .orElse(null);
        
        if (detail == null || detail.getJoiningDate() == null) {
            return balance;
        }

        LocalDate now = LocalDate.now();
        LocalDate joiningDate = detail.getJoiningDate();
        LocalDate eligibilityDate = joiningDate.plusMonths(6);
        LocalDate elEligibilityDate = joiningDate.plusYears(1);

        // 1. Handle Year Reset (Jan 1) for Casual and Sick Leaves
        if (balance.getLastUpdated() != null && balance.getLastUpdated().getYear() < now.getYear()) {
            balance.setCasualLeavesUsed(0.0);
            balance.setSickLeavesUsed(0.0);
            // Earned Leave used is NOT reset (carry forward)
        }

        // 2. Probation check
        if (now.isBefore(eligibilityDate)) {
            balance.setCasualLeavesTotal(0.0);
            balance.setSickLeavesTotal(0.0);
            balance.setEarnedLeavesTotal(0.0);
        } else {
            // 3. Casual and Sick Leave Accrual (Pro-rata)
            LocalDate startOfThisYear = LocalDate.of(now.getYear(), 1, 1);
            LocalDate clAccrualStart = eligibilityDate.isAfter(startOfThisYear) ? eligibilityDate : startOfThisYear;

            if (!now.isBefore(clAccrualStart)) {
                // Number of months since accrual start in THIS YEAR
                long monthsEligibleThisYear = ChronoUnit.MONTHS.between(clAccrualStart.withDayOfMonth(1), now.withDayOfMonth(1)) + 1;
                balance.setCasualLeavesTotal(round(Math.min(10.0, monthsEligibleThisYear * (10.0 / 12.0))));
                balance.setSickLeavesTotal(round(Math.min(6.0, monthsEligibleThisYear * 0.5)));
            } else {
                balance.setCasualLeavesTotal(0.0);
                balance.setSickLeavesTotal(0.0);
            }

            // 4. Earned Leave (EL) accrual (Cumulative since 1 year completion)
            if (!now.isBefore(elEligibilityDate)) {
                long elMonths = ChronoUnit.MONTHS.between(elEligibilityDate.withDayOfMonth(1), now.withDayOfMonth(1)) + 1;
                balance.setEarnedLeavesTotal(round(elMonths * 1.0));
            } else {
                balance.setEarnedLeavesTotal(0.0);
            }
        }
        
        return leaveBalanceRepository.save(balance);
    }

    private double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    public LeaveBalance getLeaveBalance(Long employeeId) {
        LeaveBalance balance = leaveBalanceRepository.findByEmployeeId(employeeId)
                .orElseGet(() -> initializeLeaveBalance(employeeId));
        return refreshLeaveBalance(balance);
    }

    public Double getRemainingLeaves(Long employeeId) {
        LeaveBalance balance = getLeaveBalance(employeeId);
        return round(balance.getCasualLeavesRemaining() + balance.getSickLeavesRemaining()
                + balance.getEarnedLeavesRemaining());
    }
}
