package com.hrms.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.Statement;

/**
 * Runs one-time SQL fixes at application startup that Hibernate's ddl-auto=update
 * cannot handle automatically (e.g., dropping NOT NULL constraints from existing columns).
 */
@Component
public class DatabaseMigrationRunner implements ApplicationRunner {

    @Autowired
    private DataSource dataSource;

    @Override
    public void run(ApplicationArguments args) {
        try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
            // Allow start_time and end_time to be NULL in the timesheets table.
            // These were previously @NotNull in the entity but many entry types (leave, holiday)
            // don't have meaningful time values. Hibernate's ddl-auto=update does NOT drop
            // existing NOT NULL constraints, so we do it manually here.
            stmt.execute("ALTER TABLE timesheets ALTER COLUMN start_time DROP NOT NULL");
            stmt.execute("ALTER TABLE timesheets ALTER COLUMN end_time DROP NOT NULL");
            System.out.println("[DatabaseMigrationRunner] Successfully dropped NOT NULL on start_time/end_time");
        } catch (Exception e) {
            // Column might already be nullable (idempotent) or table might not exist yet — both fine
            System.out.println("[DatabaseMigrationRunner] Note: " + e.getMessage());
        }
    }
}
