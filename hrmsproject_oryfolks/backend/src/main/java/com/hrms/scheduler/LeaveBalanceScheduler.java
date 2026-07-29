package com.hrms.scheduler;

import com.hrms.model.LeaveBalance;
import com.hrms.repository.LeaveBalanceRepository;
import com.hrms.service.LeaveBalanceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class LeaveBalanceScheduler {

    @Autowired
    private LeaveBalanceRepository leaveBalanceRepository;

    @Autowired
    private LeaveBalanceService leaveBalanceService;

    // Run every day at midnight
    @Scheduled(cron = "0 0 0 * * *")
    public void refreshAllLeaveBalances() {
        List<LeaveBalance> allBalances = leaveBalanceRepository.findAll();
        for (LeaveBalance balance : allBalances) {
            try {
                leaveBalanceService.refreshLeaveBalance(balance);
            } catch (Exception e) {
                // Log error for specific employee but continue with others
                System.err.println("Failed to refresh leave balance for employee ID: " + 
                    (balance.getEmployee() != null ? balance.getEmployee().getId() : "unknown") + 
                    ". Error: " + e.getMessage());
            }
        }
    }
}
