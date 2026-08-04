package com.hrms.repository;

import com.hrms.model.PasswordSetupToken;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PasswordSetupTokenRepository extends JpaRepository<PasswordSetupToken, Long> {
    Optional<PasswordSetupToken> findByToken(String token);
    java.util.List<PasswordSetupToken> findByEmployee(com.hrms.model.Employee employee);
}
