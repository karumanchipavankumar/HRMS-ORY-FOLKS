package com.hrms.config;

import com.hrms.model.Employee;
import com.hrms.model.EmployeeReporting;
import com.hrms.model.Role;
import com.hrms.model.User;
import com.hrms.repository.EmployeeReportingRepository;
import com.hrms.repository.EmployeeRepository;
import com.hrms.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Component
@Order(2)
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;
    private final EmployeeReportingRepository reportingRepository;
    private final com.hrms.service.EmployeeReportingService reportingService;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        System.out.println("Starting DataInitializer: Checking User-Employee mappings...");

        // 1. Ensure all Users have an Employee record
        List<User> allUsers = userRepository.findAll();
        for (User user : allUsers) {
            if (employeeRepository.findByUser(user).isEmpty()) {
                System.out.println("Creating missing Employee record for user: " + user.getUsername());
                Employee emp = new Employee();
                emp.setUser(user);
                emp.setEmail(user.getEmail());

                // Set default name based on username
                String name = user.getUsername().substring(0, 1).toUpperCase() + user.getUsername().substring(1);
                emp.setFirstName(name);
                emp.setLastName("User");
                
                // Add required fields to avoid validation errors
                emp.setPhoneNumber("9000000000"); // Default dummy phone
                emp.setDateOfBirth(LocalDate.of(1990, 1, 1)); // Default DOB
                emp.setGender("Other");

                emp.setActive(true);
                employeeRepository.save(emp);
            }
        }

        // 2. Sync reporting relationships for all employees based on role-based rules
        List<Employee> allEmployees = employeeRepository.findAll();
        for (Employee emp : allEmployees) {
            try {
                reportingService.syncReportingRelationshipsForEmployee(emp);
            } catch (Exception e) {
                System.err.println("Error seeding reporting for employee " + emp.getId() + ": " + e.getMessage());
            }
        }
        System.out.println("DataInitializer: Check complete.");
    }
}

