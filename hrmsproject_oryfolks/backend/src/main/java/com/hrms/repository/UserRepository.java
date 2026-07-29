//package com.hrms.repository;
//
//import com.hrms.model.User;
//import com.hrms.model.Role;
//import org.springframework.data.jpa.repository.JpaRepository;
//import org.springframework.stereotype.Repository;
//import java.util.List;
//import java.util.Optional;
//
//@Repository
//public interface UserRepository extends JpaRepository<User, Long> {
//    User findByUsername(String username);
//    Optional<User> findByEmail(String email);
//    List<User> findByRole(Role role);
//    List<User> findByActive(Boolean active);
//}
//
package com.hrms.repository;

import com.hrms.model.User;
import com.hrms.model.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    // Case-insensitive lookup for login so usernames match regardless of typed case
    // (e.g. OF-IT-YY-0002 vs of-it-yy-0002). Generates WHERE LOWER(username) = LOWER(?).
    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmail(String email);

    List<User> findByRole(Role role);

    List<User> findByActive(Boolean active);
}
