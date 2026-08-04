package com.hrms.controller;

import com.hrms.model.Employee;
import com.hrms.model.PasswordSetupToken;
import com.hrms.model.User;
import com.hrms.repository.PasswordSetupTokenRepository;
import com.hrms.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/password")
public class PasswordController {

    @Autowired
    private PasswordSetupTokenRepository passwordSetupTokenRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @GetMapping("/validate-token")
    public ResponseEntity<?> validateToken(@RequestParam String token) {
        Optional<PasswordSetupToken> tokenOpt = passwordSetupTokenRepository.findByToken(token);
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Invalid setup token"));
        }

        PasswordSetupToken setupToken = tokenOpt.get();
        if (setupToken.isUsed()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token has already been used"));
        }

        if (setupToken.getExpiryTime().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token has expired"));
        }

        Employee emp = setupToken.getEmployee();
        String employeeName = (emp.getFirstName() + " " + emp.getLastName()).trim();
        String loginId = emp.getUser() != null ? emp.getUser().getUsername() : emp.getCorporateEmail();

        return ResponseEntity.ok(Map.of(
                "employeeName", employeeName,
                "loginId", loginId,
                "email", emp.getEmail()
        ));
    }

    @PostMapping("/verify-temp")
    public ResponseEntity<?> verifyTempPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String tempPassword = body.get("tempPassword");

        if (token == null || token.isBlank() || tempPassword == null || tempPassword.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token and temporary password are required"));
        }

        Optional<PasswordSetupToken> tokenOpt = passwordSetupTokenRepository.findByToken(token);
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Invalid setup token"));
        }

        PasswordSetupToken setupToken = tokenOpt.get();
        if (setupToken.isUsed()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token has already been used"));
        }

        if (setupToken.getExpiryTime().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token has expired"));
        }

        Employee emp = setupToken.getEmployee();
        User user = emp.getUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "No user account found for this employee"));
        }

        if (!passwordEncoder.matches(tempPassword, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Incorrect temporary password"));
        }

        return ResponseEntity.ok(Map.of("message", "Temporary password verified successfully"));
    }

    @PostMapping("/set")
    public ResponseEntity<?> setPassword(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String tempPassword = body.get("tempPassword");
        String password = body.get("password");
        String confirmPassword = body.get("confirmPassword");

        if (token == null || token.isBlank() || tempPassword == null || tempPassword.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token, temporary password, and new password are required"));
        }

        if (!password.equals(confirmPassword)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Passwords do not match"));
        }

        // Validate password strength: >= 12 chars, uppercase, lowercase, digit, special character
        if (password.length() < 12) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Password must be at least 12 characters long"));
        }
        if (!password.matches(".*[A-Z].*")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Password must contain at least one uppercase letter"));
        }
        if (!password.matches(".*[a-z].*")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Password must contain at least one lowercase letter"));
        }
        if (!password.matches(".*[0-9].*")) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Password must contain at least one digit"));
        }

        // Search for special characters sequentially to bypass regex unclosed character class issues
        String specialChars = "!@#$%^&*()-_=+[]{}|;:,.<>/?";
        boolean hasSpecial = false;
        for (char c : password.toCharArray()) {
            if (specialChars.indexOf(c) >= 0) {
                hasSpecial = true;
                break;
            }
        }
        if (!hasSpecial) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Password must contain at least one special character"));
        }

        Optional<PasswordSetupToken> tokenOpt = passwordSetupTokenRepository.findByToken(token);
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Invalid setup token"));
        }

        PasswordSetupToken setupToken = tokenOpt.get();
        if (setupToken.isUsed()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token has already been used"));
        }

        if (setupToken.getExpiryTime().isBefore(LocalDateTime.now())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Token has expired"));
        }

        Employee emp = setupToken.getEmployee();
        User user = emp.getUser();
        if (user == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "No user account found for this employee"));
        }

        // Verify temporary password before setting the new one
        if (!passwordEncoder.matches(tempPassword, user.getPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Incorrect temporary password"));
        }

        // Update password and reset passwordResetRequired flag
        user.setPassword(passwordEncoder.encode(password));
        user.setPasswordResetRequired(false);
        userRepository.save(user);

        // Mark token as used
        setupToken.setUsed(true);
        passwordSetupTokenRepository.save(setupToken);

        return ResponseEntity.ok(Map.of("message", "Password has been set up successfully."));
    }
}
